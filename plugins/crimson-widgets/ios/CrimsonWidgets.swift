import Foundation
import React
import UIKit
import WidgetKit

/// Runs in the containing app. The extension reads only this small shared snapshot.
@objc(CrimsonWidgets)
final class CrimsonWidgets: NSObject {
  private let group = "__APP_GROUP__"
  private var artworkTask: URLSessionDataTask?
  private var artworkSource: String?
  private var revision = 0

  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc var methodQueue: DispatchQueue { DispatchQueue.main }

  @objc(updateSnapshot:resolver:rejecter:)
  func updateSnapshot(_ json: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let data = json.data(using: .utf8), data.count < 32_768,
      let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let defaults = UserDefaults(suiteName: group) else {
      reject("widget_snapshot", "Could not save the widget snapshot", nil)
      return
    }
    defaults.set(json, forKey: "snapshot")
    let source = snapshot["artworkUrl"] as? String ?? ""
    if source != artworkSource {
      revision += 1
      artworkTask?.cancel()
      artworkSource = source
      defaults.removeObject(forKey: "artworkSource")
      // Blank the prior account/track art immediately while the next thumbnail loads.
      if let file = artworkFile { try? FileManager.default.removeItem(at: file) }
      if let url = URL(string: source), ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
        loadArtwork(url, source: source, revision: revision)
      } else if let url = URL(string: source), url.isFileURL,
        let data = try? Data(contentsOf: url) {
        storeArtwork(data, source: source, revision: revision)
      }
    }
    WidgetCenter.shared.reloadTimelines(ofKind: "CrimsonListening")
    resolve(nil)
  }

  private var artworkFile: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("widget-artwork.jpg")
  }

  private func loadArtwork(_ url: URL, source: String, revision: Int) {
    var request = URLRequest(url: url)
    request.timeoutInterval = 12
    artworkTask = URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
      guard let data, data.count <= 8_000_000,
        let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { return }
      DispatchQueue.main.async { self?.storeArtwork(data, source: source, revision: revision) }
    }
    artworkTask?.resume()
  }

  private func storeArtwork(_ data: Data, source: String, revision: Int) {
    guard revision == self.revision, let image = UIImage(data: data), let file = artworkFile,
      let thumbnail = image.preparingThumbnail(of: CGSize(width: 384, height: 384)),
      let jpeg = thumbnail.jpegData(compressionQuality: 0.85) else { return }
    do {
      try jpeg.write(to: file, options: .atomic)
      UserDefaults(suiteName: group)?.set(source, forKey: "artworkSource")
      WidgetCenter.shared.reloadTimelines(ofKind: "CrimsonListening")
    } catch { /* The text widget remains useful when artwork cannot be cached. */ }
  }
}
