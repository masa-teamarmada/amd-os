#!/usr/bin/env swift
// Convert single-page PDF to PNG using macOS PDFKit
// Usage: swift pdf2png.swift input.pdf output.png [dpi=300]
import Foundation
import AppKit
import PDFKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("Usage: pdf2png.swift in.pdf out.png [dpi=300]\n".data(using: .utf8)!)
    exit(1)
}

let pdfURL = URL(fileURLWithPath: args[1])
let pngURL = URL(fileURLWithPath: args[2])
let dpi = args.count >= 4 ? (Int(args[3]) ?? 300) : 300

guard let doc = PDFDocument(url: pdfURL), let page = doc.page(at: 0) else {
    FileHandle.standardError.write("failed to load PDF\n".data(using: .utf8)!)
    exit(2)
}

let mediaBox = page.bounds(for: .mediaBox)
let scale = CGFloat(dpi) / 72.0
let pxW = Int((mediaBox.width * scale).rounded())
let pxH = Int((mediaBox.height * scale).rounded())

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: pxW, pixelsHigh: pxH,
    bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 32) else { exit(3) }

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext
ctx.clear(CGRect(x: 0, y: 0, width: pxW, height: pxH))
ctx.scaleBy(x: scale, y: scale)
page.draw(with: .mediaBox, to: ctx)
NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else { exit(4) }
try png.write(to: pngURL)
print("\(pxW)x\(pxH)")
