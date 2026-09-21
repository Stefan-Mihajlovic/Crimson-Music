import SwiftUI
import UIKit
import WidgetKit

private let appGroup = "__APP_GROUP__"

struct ListeningSnapshot: Decodable {
  let signedIn: Bool
  let title: String
  let artist: String
  let artworkUrl: String
  let playing: Bool
  let hasTrack: Bool
  let canGoNext: Bool
  let canGoPrevious: Bool
  let source: String
  let nextTitle: String
  let updatedAt: Double

  static let empty = ListeningSnapshot(signedIn: false, title: "Your music, ready", artist: "Open Crimson to start listening", artworkUrl: "", playing: false, hasTrack: false, canGoNext: false, canGoPrevious: false, source: "", nextTitle: "", updatedAt: 0)
  static let preview = ListeningSnapshot(signedIn: true, title: "Your next favorite", artist: "Made for your everyday", artworkUrl: "", playing: false, hasTrack: true, canGoNext: true, canGoPrevious: true, source: "Daily Mix", nextTitle: "More music you love", updatedAt: 0)
}

struct ListeningEntry: TimelineEntry {
  let date: Date
  let snapshot: ListeningSnapshot
  let artwork: UIImage?
}

struct ListeningProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListeningEntry {
    ListeningEntry(date: Date(), snapshot: .preview, artwork: nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (ListeningEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : readEntry())
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<ListeningEntry>) -> Void) {
    // WidgetKit controls refresh timing. No pretend live playback clock.
    completion(Timeline(entries: [readEntry()], policy: .never))
  }
  private func readEntry() -> ListeningEntry {
    let defaults = UserDefaults(suiteName: appGroup)
    let snapshot = defaults?.string(forKey: "snapshot")?.data(using: .utf8)
      .flatMap { try? JSONDecoder().decode(ListeningSnapshot.self, from: $0) } ?? .empty
    var artwork: UIImage?
    if !snapshot.artworkUrl.isEmpty, defaults?.string(forKey: "artworkSource") == snapshot.artworkUrl,
      let file = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appendingPathComponent("widget-artwork.jpg") {
      artwork = UIImage(contentsOfFile: file.path)
    }
    return ListeningEntry(date: Date(), snapshot: snapshot, artwork: artwork)
  }
}

private func destination(_ action: String, kind: String? = nil) -> URL {
  var components = URLComponents(string: "crimsonmusic://widget")!
  components.queryItems = [URLQueryItem(name: "action", value: action)]
  if let kind { components.queryItems?.append(URLQueryItem(name: "kind", value: kind)) }
  return components.url!
}

struct CrimsonListeningView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ListeningEntry
  // Match BrandAccent.dark and the app's dark surfaces.
  private let accent = Color(red: 150.0 / 255, green: 92.0 / 255, blue: 1)
  private var snapshot: ListeningSnapshot { entry.snapshot }
  private var background: some View {
    LinearGradient(colors: [Color(red: 33.0 / 255, green: 27.0 / 255, blue: 41.0 / 255), Color(red: 14.0 / 255, green: 13.0 / 255, blue: 19.0 / 255)], startPoint: .topLeading, endPoint: .bottomTrailing)
  }

  var body: some View {
    Group {
      if #available(iOS 17.0, *) { content.containerBackground(for: .widget) { background } }
      else { content.padding(16).background(background) }
    }
    .foregroundStyle(.white)
    .widgetURL(destination("resume"))
  }

  @ViewBuilder private var content: some View {
    if family == .systemSmall { small }
    else {
      VStack(alignment: .leading, spacing: family == .systemLarge ? 12 : 10) {
        HStack { brand; Spacer(); Text("Open to play").font(.system(size: 10, weight: .medium)).foregroundStyle(.white.opacity(0.5)) }
        HStack(spacing: 12) {
          artwork(size: family == .systemLarge ? 72 : 52)
          VStack(alignment: .leading, spacing: 4) {
            Text(snapshot.title).font(.system(size: 16, weight: .bold)).lineLimit(2)
            Text(snapshot.artist).font(.system(size: 12)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
            if family == .systemLarge, !snapshot.source.isEmpty {
              Text(snapshot.source).font(.system(size: 11, weight: .medium)).foregroundStyle(accent).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
          control(snapshot.playing ? "pause" : "resume", symbol: snapshot.playing ? "pause.fill" : "play.fill", label: snapshot.playing ? "Open Crimson and pause" : "Open Crimson and resume", prominent: true)
        }
        if family == .systemLarge {
          HStack(spacing: 18) {
            control("previous", symbol: "backward.end.fill", label: "Open Crimson and play previous", enabled: snapshot.canGoPrevious)
            Text(snapshot.nextTitle.isEmpty ? "Make room for a new favorite" : "Up next · \(snapshot.nextTitle)")
              .font(.system(size: 11)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
            Spacer(minLength: 0)
            control("next", symbol: "forward.end.fill", label: "Open Crimson and play next", enabled: snapshot.canGoNext)
          }
          Divider().overlay(.white.opacity(0.12))
          Text("Your music").font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
          LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 10) {
            shortcut("Favorites", symbol: "heart.fill", action: "favorites")
            shortcut("Daily Mix", symbol: "sun.max.fill", action: "mix", kind: "daily")
            shortcut("Weekly Mix", symbol: "sparkles", action: "mix", kind: "weekly")
            shortcut("Monthly Mix", symbol: "moon.stars.fill", action: "mix", kind: "monthly")
            shortcut("Local Music", symbol: "iphone", action: "local")
            shortcut("Recently played", symbol: "clock.arrow.circlepath", action: "history")
          }
          Spacer(minLength: 0)
        } else {
          HStack(spacing: 8) {
            shortcut("Favorites", symbol: "heart.fill", action: "favorites")
            shortcut("Daily Mix", symbol: "sparkles", action: "mix", kind: "daily")
            Spacer(minLength: 0)
            control("next", symbol: "forward.end.fill", label: "Open Crimson and play next", enabled: snapshot.canGoNext)
          }
        }
      }
    }
  }

  private var small: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack { artwork(size: 42); Spacer(); Image(systemName: "play.circle.fill").font(.system(size: 25)).foregroundStyle(accent) }
      Spacer(minLength: 0)
      Text(snapshot.title).font(.system(size: 14, weight: .bold)).lineLimit(2).minimumScaleFactor(0.8)
      Text(snapshot.artist).font(.system(size: 11)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
      HStack(spacing: 5) { logo(size: 14); Text("Open and resume").font(.system(size: 10, weight: .medium)).foregroundStyle(accent) }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(snapshot.title), \(snapshot.artist). Open Crimson and resume.")
  }

  private var brand: some View {
    HStack(spacing: 6) { logo(size: 20); Text("Crimson") }.font(.system(size: 12, weight: .semibold))
  }

  private func logo(size: CGFloat) -> some View {
    Image("crimson-logo").resizable().scaledToFit().frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: size * 0.23)).accessibilityHidden(true)
  }

  private func artwork(size: CGFloat) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 10).fill(accent.opacity(0.18))
      if let image = entry.artwork { Image(uiImage: image).resizable().scaledToFill() }
      else { Image(systemName: "music.note").font(.system(size: size * 0.38)).foregroundStyle(accent) }
    }.frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: 10)).accessibilityHidden(true)
  }

  private func control(_ action: String, symbol: String, label: String, prominent: Bool = false, enabled: Bool = true) -> some View {
    Link(destination: destination(enabled ? action : "library")) {
      Image(systemName: symbol).font(.system(size: prominent ? 18 : 14, weight: .semibold))
        .frame(width: prominent ? 42 : 30, height: prominent ? 42 : 30)
        .background(prominent ? accent : .white.opacity(0.07), in: Circle())
        .opacity(enabled ? 1 : 0.35)
    }.accessibilityLabel(enabled ? label : "Open Crimson library")
  }

  private func shortcut(_ title: String, symbol: String, action: String, kind: String? = nil) -> some View {
    Link(destination: destination(action, kind: kind)) {
      HStack(spacing: 6) {
        Image(systemName: symbol).foregroundStyle(accent).frame(width: 14)
        Text(title).lineLimit(1).minimumScaleFactor(0.75)
      }.font(.system(size: 11, weight: .semibold)).padding(.vertical, 8).padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
    }.accessibilityLabel("Open \(title) in Crimson")
  }
}

@main
struct CrimsonListeningWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CrimsonListening", provider: ListeningProvider()) { CrimsonListeningView(entry: $0) }
      .configurationDisplayName("Crimson Music")
      .description("Resume your music and open Favorites, personal mixes, and your local library.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
