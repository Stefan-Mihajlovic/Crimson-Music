#!/usr/bin/env swift
// Run from the repository root: swift scripts/export-app-icon.swift
// Flat platform exports share Icon Composer's vector geometry; Apple supplies
// its own dynamic materials when compiling assets/Crimson.icon.
import AppKit
import Foundation

struct Icon: Decodable {
    struct Group: Decodable {
        struct Layer: Decodable {
            let imageName: String
            enum CodingKeys: String, CodingKey { case imageName = "image-name" }
        }
        let layers: [Layer]
    }
    let groups: [Group]
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = root.appendingPathComponent("assets/Crimson.icon")
let icon = try JSONDecoder().decode(Icon.self, from: Data(contentsOf: source.appendingPathComponent("icon.json")))
// Composer's first layer is in front; AppKit draws back to front.
let layers = try icon.groups.reversed().flatMap { group in
    try group.layers.reversed().map { layer -> NSImage in
        let url = source.appendingPathComponent("Assets/\(layer.imageName)")
        guard let image = NSImage(contentsOf: url) else {
            throw NSError(domain: "CrimsonIcon", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(url.path)"])
        }
        return image
    }
}

func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: 1)
}

func export(_ filename: String, size: Int = 1024, background: Bool = false,
            mark: Bool = true, scale: CGFloat = 1, monochrome: Bool = false) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    bitmap.size = NSSize(width: size, height: size)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current?.imageInterpolation = .high
    let bounds = NSRect(x: 0, y: 0, width: size, height: size)
    if background {
        NSGradient(starting: color(0x170C27), ending: color(0x281146))!.draw(in: bounds, angle: 90)
    }
    if mark {
        let inset = CGFloat(size) * (1 - scale) / 2
        for layer in layers {
            layer.draw(in: bounds.insetBy(dx: inset, dy: inset), from: .zero,
                       operation: .sourceOver, fraction: 1)
        }
    }
    if monochrome {
        NSColor.white.setFill()
        bounds.fill(using: .sourceIn)
    }
    NSGraphicsContext.restoreGraphicsState()
    let output = root.appendingPathComponent("assets/images/\(filename).png")
    try bitmap.representation(using: .png, properties: [:])!.write(to: output)
    print("Exported \(output.lastPathComponent) (\(size) × \(size))")
}

try export("icon", background: true)
try export("android-icon-background", background: true, mark: false)
// All visible pixels stay inside Android's central 66/108 safe circle.
try export("android-icon-foreground", scale: 0.56)
try export("android-icon-monochrome", scale: 0.56, monochrome: true)
try export("splash-icon")
try export("favicon", size: 48, background: true)
