import AVFoundation
import Foundation
import CryptoKit
import ImageIO
import UIKit
import MediaPlayer
import React

@objc(CrimsonRemoteControls)
final class CrimsonRemoteControls: RCTEventEmitter {
  private let commandCenter = MPRemoteCommandCenter.shared()
  private let nowPlayingInfoCenter = MPNowPlayingInfoCenter.default()
  private var hasListeners = false
  private var likeTarget: Any?
  private var nextTarget: Any?
  private var previousTarget: Any?
  private static let artworkPaletteQueue = DispatchQueue(label: "com.crimson.artwork-palette", qos: .utility)

  override init() {
    super.init()
    installCommandTargets()
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["remoteLike", "remoteNext", "remotePrevious"]
  }

  override func constantsToExport() -> [AnyHashable: Any]! {
    // A synchronous round placeholder prevents native tabs from starting a load
    // of the uncropped remote photo while its circular thumbnail is prepared.
    let size = CGSize(width: 28, height: 28)
    let format = UIGraphicsImageRendererFormat()
    format.opaque = false
    format.scale = 3
    let data = UIGraphicsImageRenderer(size: size, format: format).pngData { _ in
      let bounds = CGRect(origin: .zero, size: size)
      UIBezierPath(ovalIn: bounds).addClip()
      UIColor(red: 0.22, green: 0.15, blue: 0.32, alpha: 1).setFill()
      UIRectFill(bounds)
      UIImage(systemName: "person.fill")?
        .withTintColor(UIColor(red: 0.88, green: 0.80, blue: 1, alpha: 1), renderingMode: .alwaysOriginal)
        .draw(in: CGRect(x: 5, y: 5, width: 18, height: 19))
    }
    return ["accountTabFallbackIcon": "data:image/png;base64,\(data.base64EncodedString())"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // Native tabs require an image source, so render the avatar once as a small
  // transparent PNG instead of tinting the user's photo as an SF Symbol.
  @objc(createCircularTabIcon:resolver:rejecter:)
  func createCircularTabIcon(
    _ source: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: source), ["https", "http", "file"].contains(url.scheme ?? "") else {
      reject("invalid_avatar", "The profile photo URL is invalid.", nil)
      return
    }
    let hash = SHA256.hash(data: Data(source.utf8)).map { String(format: "%02x", $0) }.joined()
    let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("CrimsonTabIcons", isDirectory: true)
    let destination = directory.appendingPathComponent("\(hash).png")
    if FileManager.default.fileExists(atPath: destination.path) {
      resolve(destination.absoluteString)
      return
    }
    let render: (Data) -> Void = { data in
      do {
        guard data.count <= 8 * 1024 * 1024,
              let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 128,
              ] as CFDictionary) else {
          reject("invalid_avatar", "The profile photo could not be decoded.", nil)
          return
        }
        let image = UIImage(cgImage: thumbnail)
        let size = CGSize(width: 28, height: 28)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = 3
        let output = UIGraphicsImageRenderer(size: size, format: format).pngData { _ in
          UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).addClip()
          let scale = max(size.width / image.size.width, size.height / image.size.height)
          let width = image.size.width * scale
          let height = image.size.height * scale
          image.draw(in: CGRect(x: (28 - width) / 2, y: (28 - height) / 2, width: width, height: height))
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try output.write(to: destination, options: .atomic)
        resolve(destination.absoluteString)
      } catch {
        reject("avatar_render_failed", "The profile photo could not be prepared.", error)
      }
    }
    if url.isFileURL {
      DispatchQueue.global(qos: .userInitiated).async {
        do { render(try Data(contentsOf: url)) }
        catch { reject("avatar_load_failed", "The profile photo could not be loaded.", error) }
      }
    } else {
      let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15)
      URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data, error == nil, let response = response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else {
          reject("avatar_load_failed", "The profile photo could not be loaded.", error)
          return
        }
        render(data)
      }.resume()
    }
  }

  // This work is independent of the audio session. A tiny decoded thumbnail is
  // enough to find the cover's colors, and the resulting palette survives launch.
  @objc(extractArtworkPalette:cacheKey:allowNetwork:resolver:rejecter:)
  func extractArtworkPalette(
    _ source: String,
    cacheKey: String,
    allowNetwork: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.artworkPaletteQueue.async {
      let hash = SHA256.hash(data: Data(cacheKey.utf8)).map { String(format: "%02x", $0) }.joined()
      let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("CrimsonArtworkPalettes-v1", isDirectory: true)
      let destination = directory.appendingPathComponent("\(hash).json")
      if let data = try? Data(contentsOf: destination),
         let colors = try? JSONDecoder().decode([String].self, from: data), colors.count == 3 {
        resolve(colors)
        return
      }
      guard let url = URL(string: source), ["https", "http", "file"].contains(url.scheme ?? "") else {
        reject("invalid_artwork", "The artwork URL is invalid.", nil)
        return
      }
      let extract: (Data) -> Void = { data in
        guard let colors = Self.artworkColors(from: data) else {
          reject("invalid_artwork", "The artwork colors could not be decoded.", nil)
          return
        }
        if let json = try? JSONEncoder().encode(colors) {
          try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
          try? json.write(to: destination, options: .atomic)
        }
        resolve(colors)
      }
      if url.isFileURL {
        guard let data = try? Data(contentsOf: url) else {
          reject("artwork_unavailable", "The cached artwork is unavailable.", nil)
          return
        }
        extract(data)
      } else if allowNetwork {
        // The caller supplies the small cover URL, never an original-size image.
        let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 12)
        URLSession.shared.dataTask(with: request) { data, response, error in
          guard let data, error == nil, let response = response as? HTTPURLResponse,
                (200..<300).contains(response.statusCode) else {
            reject("artwork_unavailable", "The artwork is unavailable.", error)
            return
          }
          Self.artworkPaletteQueue.async { extract(data) }
        }.resume()
      } else {
        reject("artwork_not_cached", "No cached artwork palette is available.", nil)
      }
    }
  }

  private static func artworkColors(from data: Data) -> [String]? {
    guard data.count <= 8 * 1024 * 1024,
          let source = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 48,
          ] as CFDictionary) else { return nil }
    let size = 48
    var pixels = [UInt8](repeating: 0, count: size * size * 4)
    let drewImage = pixels.withUnsafeMutableBytes { bytes -> Bool in
      guard let context = CGContext(
        data: bytes.baseAddress, width: size, height: size,
        bitsPerComponent: 8, bytesPerRow: size * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
      ) else { return false }
      context.interpolationQuality = .low
      context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(size), height: CGFloat(size)))
      return true
    }
    guard drewImage else { return nil }

    struct Swatch {
      var count = 0.0
      var red = 0.0
      var green = 0.0
      var blue = 0.0
      var weight = 0.0
      var rgb: [Double] { [red / count, green / count, blue / count] }
    }
    var histogram: [Int: Swatch] = [:]
    for index in stride(from: 0, to: pixels.count, by: 4) {
      let alpha = Double(pixels[index + 3]) / 255
      guard alpha > 0.5 else { continue }
      let red = min(255, Double(pixels[index]) / alpha)
      let green = min(255, Double(pixels[index + 1]) / alpha)
      let blue = min(255, Double(pixels[index + 2]) / alpha)
      let highest = max(red, max(green, blue)) / 255
      let lowest = min(red, min(green, blue)) / 255
      let saturation = highest > 0 ? (highest - lowest) / highest : 0
      // Retain neutral covers, while preventing black borders and white text
      // from drowning out a red, blue, or green illustration.
      let exposure = max(0.025, min(1, highest * 3))
      let whitePenalty = highest > 0.92 && saturation < 0.12 ? 0.12 : 1.0
      let weight = (0.12 + saturation * saturation * 2.4) * exposure * whitePenalty
      let key = (Int(red) >> 4) << 8 | (Int(green) >> 4) << 4 | (Int(blue) >> 4)
      var swatch = histogram[key] ?? Swatch()
      swatch.count += 1
      swatch.red += red
      swatch.green += green
      swatch.blue += blue
      swatch.weight += weight
      histogram[key] = swatch
    }
    var candidates = histogram.values.sorted { $0.weight > $1.weight }
    guard let dominant = candidates.first else { return nil }
    var chosen = [dominant]
    candidates.removeFirst()
    while chosen.count < 3 && !candidates.isEmpty {
      // Favor a distinct secondary region without inventing colors absent from
      // the cover. Even monochrome artwork therefore stays monochrome.
      let index = candidates.indices.max { left, right in
        func score(_ swatch: Swatch) -> Double {
          let rgb = swatch.rgb
          let distance = chosen.map { selected -> Double in
            let other = selected.rgb
            return sqrt(zip(rgb, other).reduce(0) { $0 + pow(($1.0 - $1.1) / 255, 2) })
          }.min() ?? 0
          return swatch.weight * (0.08 + distance * distance * 5)
        }
        return score(candidates[left]) < score(candidates[right])
      } ?? candidates.startIndex
      chosen.append(candidates.remove(at: index))
    }
    while chosen.count < 3 { chosen.append(dominant) }
    return chosen.map { swatch in
      let rgb = swatch.rgb.map { Int($0.rounded()) }
      return String(format: "#%02X%02X%02X", rgb[0], rgb[1], rgb[2])
    }
  }

  @objc(configure:liked:canGoNext:canGoPrevious:playing:elapsedTime:duration:)
  func configure(
    _ active: Bool,
    liked: Bool,
    canGoNext: Bool,
    canGoPrevious: Bool,
    playing: Bool,
    elapsedTime: Double,
    duration: Double
  ) {
    let update: () -> Void = { [weak self] in
      guard let self else { return }
      self.configureOnMain(
        active,
        liked: liked,
        canGoNext: canGoNext,
        canGoPrevious: canGoPrevious,
        playing: playing,
        elapsedTime: elapsedTime,
        duration: duration
      )
    }
    if Thread.isMainThread {
      update()
    } else {
      DispatchQueue.main.async(execute: update)
    }
  }

  private func configureOnMain(
    _ active: Bool,
    liked: Bool,
    canGoNext: Bool,
    canGoPrevious: Bool,
    playing: Bool,
    elapsedTime: Double,
    duration: Double
  ) {
    commandCenter.nextTrackCommand.isEnabled = active && canGoNext
    commandCenter.previousTrackCommand.isEnabled = active && canGoPrevious
    commandCenter.likeCommand.isEnabled = active
    commandCenter.likeCommand.isActive = liked
    updateLikeLabels(liked: liked)
    updatePlaybackState(
      active: active,
      playing: playing,
      elapsedTime: elapsedTime,
      duration: duration
    )
  }

  private func installCommandTargets() {
    nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
      self?.emit("remoteNext") ?? .commandFailed
    }
    previousTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
      self?.emit("remotePrevious") ?? .commandFailed
    }
    likeTarget = commandCenter.likeCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      self.commandCenter.likeCommand.isActive.toggle()
      self.updateLikeLabels(liked: self.commandCenter.likeCommand.isActive)
      return self.emit("remoteLike")
    }
  }

  private func updateLikeLabels(liked: Bool) {
    commandCenter.likeCommand.localizedTitle = liked ? "Unlike Song" : "Like Song"
    commandCenter.likeCommand.localizedShortTitle = liked ? "Unlike" : "Like"
  }

  private func updatePlaybackState(
    active: Bool,
    playing: Bool,
    elapsedTime: Double,
    duration: Double
  ) {
    guard active else {
      nowPlayingInfoCenter.playbackState = .stopped
      return
    }

    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true)
    } catch {
      // expo-audio will retry session activation when playback starts.
    }

    if var info = nowPlayingInfoCenter.nowPlayingInfo {
      info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
      info.removeValue(forKey: MPNowPlayingInfoPropertyIsLiveStream)
      if elapsedTime.isFinite {
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, elapsedTime)
      }
      if duration.isFinite && duration > 0 {
        info[MPMediaItemPropertyPlaybackDuration] = duration
      }
      nowPlayingInfoCenter.nowPlayingInfo = info
    }
    nowPlayingInfoCenter.playbackState = playing ? .playing : .paused
  }

  private func emit(_ event: String) -> MPRemoteCommandHandlerStatus {
    guard hasListeners else { return .commandFailed }
    sendEvent(withName: event, body: nil)
    return .success
  }
}
