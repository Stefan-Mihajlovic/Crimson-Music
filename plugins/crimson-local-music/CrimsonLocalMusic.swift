import AVFoundation
import CryptoKit
import Foundation
import MediaPlayer
import React
import UIKit
import UniformTypeIdentifiers

@objc(CrimsonLocalMusic)
final class CrimsonLocalMusic: NSObject, UIDocumentPickerDelegate {
  private var pickerResolve: RCTPromiseResolveBlock?
  private var pickerReject: RCTPromiseRejectBlock?
  private let worker = DispatchQueue(label: "com.crimson.local-music", qos: .userInitiated)
  private var directory: URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("CrimsonLocalMusic", isDirectory: true)
  }
  @objc static func requiresMainQueueSetup() -> Bool { true }

  private func currentURL(_ uri: String) -> URL? {
    // iOS app container UUIDs may change after an update or restore.
    if let range = uri.range(of: "/Documents/CrimsonLocalMusic/") {
      let relative = String(uri[range.upperBound...]).removingPercentEncoding ?? String(uri[range.upperBound...])
      let result = directory.appendingPathComponent(relative).standardizedFileURL
      return result.path.hasPrefix(directory.path + "/") ? result : nil
    }
    return URL(string: uri)
  }

  @objc(resolveUri:resolver:rejecter:)
  func resolveUri(_ uri: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard let url = currentURL(uri), ["file", "ipod-library"].contains(url.scheme ?? "") else {
      reject("invalid_local_uri", "This local audio file is unavailable. Scan or import it again.", nil); return
    }
    if url.isFileURL && !FileManager.default.fileExists(atPath: url.path) {
      reject("missing_local_file", "This file was removed. Import it again to play it.", nil); return
    }
    resolve(url.absoluteString)
  }

  @objc(scanDevice:rejecter:)
  func scanDevice(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let scan: (MPMediaLibraryAuthorizationStatus) -> Void = { status in
      guard status == .authorized else {
        reject("music_permission", "Allow Media & Apple Music access in system Settings to scan downloaded music. You can also import files.", nil); return
      }
      self.worker.async {
        let query = MPMediaQuery()
        query.addFilterPredicate(MPMediaPropertyPredicate(value: MPMediaType.anyAudio.rawValue, forProperty: MPMediaItemPropertyMediaType))
        var files: [[String: Any]] = []
        var skipped = 0
        for item in query.items ?? [] {
          guard !item.hasProtectedAsset, !item.isCloudItem, let uri = item.assetURL else { skipped += 1; continue }
          var record: [String: Any] = [
            "id": "ios:\(item.persistentID)", "uri": uri.absoluteString,
            "filename": uri.lastPathComponent, "title": item.title ?? "Untitled audio",
            "artist": item.artist ?? "Unknown artist", "album": item.albumTitle ?? "",
            "duration": item.playbackDuration, "kind": "device"
          ]
          if let artwork = item.artwork?.image(at: CGSize(width: 300, height: 300))?.jpegData(compressionQuality: 0.82) {
            let url = self.saveArtwork(artwork, key: "device-\(item.persistentID)")
            record["artwork"] = url?.absoluteString
          }
          files.append(record)
        }
        resolve(["files": files, "skipped": skipped])
      }
    }
    if MPMediaLibrary.authorizationStatus() == .notDetermined {
      DispatchQueue.main.async { MPMediaLibrary.requestAuthorization(scan) }
    } else { scan(MPMediaLibrary.authorizationStatus()) }
  }

  @objc(importAudio:rejecter:)
  func importAudio(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.pickerResolve == nil else { reject("picker_open", "The file picker is already open.", nil); return }
      guard let presenter = RCTPresentedViewController() else { reject("no_presenter", "Open Crimson and try again.", nil); return }
      self.pickerResolve = resolve; self.pickerReject = reject
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.audio], asCopy: true)
      picker.allowsMultipleSelection = true
      picker.delegate = self
      presenter.present(picker, animated: true)
    }
  }
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pickerResolve?(["files": [], "skipped": 0]); pickerResolve = nil; pickerReject = nil
  }
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    let resolve = pickerResolve; let reject = pickerReject
    pickerResolve = nil; pickerReject = nil
    worker.async {
      do {
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
        var files: [[String: Any]] = []
        var skipped = 0
        for source in urls {
          let accessing = source.startAccessingSecurityScopedResource()
          defer { if accessing { source.stopAccessingSecurityScopedResource() } }
          do {
            let temporary = self.directory.appendingPathComponent("\(UUID().uuidString).partial")
            defer { try? FileManager.default.removeItem(at: temporary) }
            try FileManager.default.copyItem(at: source, to: temporary)
            let handle = try FileHandle(forReadingFrom: temporary)
            defer { try? handle.close() }
            var hash = SHA256()
            while let data = try handle.read(upToCount: 256 * 1024), !data.isEmpty { hash.update(data: data) }
            let key = hash.finalize().map { String(format: "%02x", $0) }.joined()
            let destination = self.directory.appendingPathComponent(key + "." + source.pathExtension.lowercased())
            if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.moveItem(at: temporary, to: destination) }
            let record = try self.metadata(destination, originalName: source.lastPathComponent)
            try JSONSerialization.data(withJSONObject: record).write(to: destination.appendingPathExtension("json"), options: .atomic)
            files.append(record)
          } catch { skipped += 1 }
        }
        resolve?(["files": files, "skipped": skipped])
      } catch { reject?("import_failed", "Audio could not be copied. Check available device storage.", error) }
    }
  }

  private func saveArtwork(_ data: Data, key: String) -> URL? {
    let folder = directory.appendingPathComponent(".Artwork", isDirectory: true)
    let url = folder.appendingPathComponent(key + ".jpg")
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      try data.write(to: url, options: .atomic)
      return url
    } catch { return nil }
  }

  private func metadata(_ url: URL, originalName: String) throws -> [String: Any] {
    let asset = AVURLAsset(url: url)
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    let duration = CMTimeGetSeconds(asset.duration)
    var record: [String: Any] = [
      "id": "import:\(url.lastPathComponent)", "uri": url.absoluteString, "filename": originalName,
      "title": URL(fileURLWithPath: originalName).deletingPathExtension().lastPathComponent,
      "duration": duration.isFinite ? max(0, duration) : 0, "kind": "import",
      "size": (attributes[.size] as? NSNumber)?.doubleValue ?? 0,
      "modifiedAt": ((attributes[.modificationDate] as? Date) ?? Date()).timeIntervalSince1970 * 1000
    ]
    for item in asset.commonMetadata {
      switch item.commonKey {
      case .commonKeyTitle: if let value = item.stringValue { record["title"] = value }
      case .commonKeyArtist: if let value = item.stringValue { record["artist"] = value }
      case .commonKeyAlbumName: if let value = item.stringValue { record["album"] = value }
      case .commonKeyArtwork:
        if let data = item.dataValue, data.count < 8 * 1024 * 1024,
           let image = UIImage(data: data) {
          let renderer = UIGraphicsImageRenderer(size: CGSize(width: 300, height: 300))
          let thumbnail = renderer.jpegData(withCompressionQuality: 0.82) { _ in image.draw(in: CGRect(x: 0, y: 0, width: 300, height: 300)) }
          record["artwork"] = saveArtwork(thumbnail, key: url.lastPathComponent)?.absoluteString
        }
      default: break
      }
    }
    return record
  }

  @objc(listImported:rejecter:)
  func listImported(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    worker.async {
      do {
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
        let allowed = Set(["mp3", "mp2", "m4a", "m4b", "m4r", "aac", "wav", "wave", "flac", "ogg", "oga", "opus", "aif", "aiff", "aifc", "alac", "wma", "amr", "mka", "au", "snd"])
        let urls = FileManager.default.enumerator(at: self.directory, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles])
        var files: [[String: Any]] = []
        while let url = urls?.nextObject() as? URL {
          let ext = url.pathExtension.lowercased()
          let hasImportMetadata = FileManager.default.fileExists(atPath: url.appendingPathExtension("json").path)
          // The system picker accepts more audio types than our fallback list.
          // Only a paired metadata sidecar can extend that list; sidecars and artwork are never tracks.
          guard !["json", "art", "jpg", "jpeg", "png", "partial"].contains(ext),
                allowed.contains(ext) || hasImportMetadata,
                (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else { continue }
          if let data = try? Data(contentsOf: url.appendingPathExtension("json")),
             var record = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            record["uri"] = url.absoluteString
            if let art = record["artwork"] as? String { record["artwork"] = self.currentURL(art)?.absoluteString }
            files.append(record)
          } else if let record = try? self.metadata(url, originalName: url.lastPathComponent) { files.append(record) }
        }
        resolve(files)
      } catch { reject("local_library_failed", "The imported audio folder could not be read.", error) }
    }
  }

  @objc(removeImport:resolver:rejecter:)
  func removeImport(_ uri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    worker.async {
      guard let url = self.currentURL(uri), url.isFileURL,
            url.standardizedFileURL.path.hasPrefix(self.directory.path + "/") else {
        reject("invalid_import", "Only Crimson’s imported copies can be removed here.", nil); return
      }
      do {
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        try? FileManager.default.removeItem(at: url.appendingPathExtension("json"))
        resolve(nil)
      } catch { reject("remove_failed", "The imported copy could not be removed.", error) }
    }
  }
}
