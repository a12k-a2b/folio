import SwiftUI
import AVFoundation

struct VoiceCapture: Equatable {
    var b64: String
    var mime: String
    var durationMs: Int
}

struct VoicePad: View {
    var enabled: Bool
    var compact: Bool = true
    var label: String = "Hold to speak"
    var onCaptured: (VoiceCapture) -> Void

    @State private var holding = false
    @State private var recorder: AVAudioRecorder?
    @State private var startedAt: Date = .now
    @State private var fileURL: URL?
    @State private var denied = false

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Circle()
                .fill(holding ? FolioTheme.ink : FolioTheme.ink.opacity(0.92))
                .frame(width: compact ? 56 : 64, height: compact ? 56 : 64)
                .overlay {
                    Image(systemName: holding ? "waveform" : "mic.fill")
                        .font(.system(size: compact ? 20 : 22, weight: .regular))
                        .foregroundStyle(FolioTheme.paper)
                }
                .scaleEffect(holding ? 1.06 : 1)
                .animation(.easeInOut(duration: 0.12), value: holding)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in
                            if enabled && !holding { start() }
                        }
                        .onEnded { _ in
                            stop()
                        }
                )
                .opacity(enabled ? 1 : 0.35)
                .accessibilityLabel("Hold to speak")

            if !compact {
                VStack(alignment: .leading, spacing: 2) {
                    Text(holding ? "Holding · lift to stop" : label)
                        .font(FolioTheme.uiFont(size: 12))
                        .foregroundStyle(FolioTheme.inkSoft)
                    if denied {
                        Text("Microphone is off for Folio.")
                            .font(FolioTheme.pageFont(size: 13))
                            .foregroundStyle(FolioTheme.inkSoft)
                    }
                }
            }
        }
    }

    private func start() {
        requestMic { granted in
            guard granted else {
                denied = true
                return
            }
            denied = false
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker])
                try session.setActive(true)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("folio-voice.m4a")
                try? FileManager.default.removeItem(at: url)
                let settings: [String: Any] = [
                    AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                    AVSampleRateKey: 22050,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderBitRateKey: 64000,
                    AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
                ]
                let rec = try AVAudioRecorder(url: url, settings: settings)
                rec.prepareToRecord()
                rec.record()
                recorder = rec
                fileURL = url
                startedAt = Date()
                holding = true
            } catch {
                holding = false
            }
        }
    }

    private func stop() {
        let rec = recorder
        recorder = nil
        let wasHolding = holding
        holding = false
        guard wasHolding, let rec else { return }
        let dur = Int(Date().timeIntervalSince(startedAt) * 1000)
        rec.stop()
        guard let url = fileURL, let data = try? Data(contentsOf: url), data.count > 32 else { return }
        onCaptured(VoiceCapture(b64: data.base64EncodedString(), mime: "audio/m4a", durationMs: max(200, dur)))
    }

    private func requestMic(done: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { granted in
                DispatchQueue.main.async { done(granted) }
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async { done(granted) }
            }
        }
    }
}

struct VoiceBubble: View {
    let note: VoiceNote
    var mine: Bool
    var autoPlay: Bool = false

    @State private var player: AVAudioPlayer?
    @State private var playing = false
    @State private var progress: Double = 0
    @State private var timer: Timer?

    var body: some View {
        HStack {
            if mine { Spacer(minLength: 24) }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Button(action: toggle) {
                        Image(systemName: playing ? "pause.fill" : "play.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(mine ? FolioTheme.paper : FolioTheme.ink)
                            .frame(width: 36, height: 36)
                            .overlay(
                                Circle().stroke(mine ? FolioTheme.paper.opacity(0.4) : FolioTheme.ink.opacity(0.3), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(note.authorName.isEmpty ? (mine ? "You" : "A friend") : note.authorName) · \(formatMs(note.durationMs))")
                            .font(FolioTheme.uiFont(size: 10, weight: .medium))
                            .tracking(1.2)
                            .foregroundStyle(mine ? FolioTheme.paper.opacity(0.7) : FolioTheme.inkSoft)
                            .textCase(.uppercase)
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Rectangle().fill(mine ? FolioTheme.paper.opacity(0.25) : FolioTheme.rule)
                                Rectangle()
                                    .fill(mine ? FolioTheme.paper : FolioTheme.ink)
                                    .frame(width: g.size.width * progress)
                            }
                        }
                        .frame(height: 3)
                    }
                }
                if !note.transcript.isEmpty {
                    Text(note.transcript)
                        .font(FolioTheme.pageFont(size: 14))
                        .foregroundStyle(mine ? FolioTheme.paper.opacity(0.92) : FolioTheme.ink)
                        .lineSpacing(2)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: 320, alignment: .leading)
            .background(mine ? FolioTheme.ink : FolioTheme.paper2)
            .overlay(Rectangle().stroke(mine ? FolioTheme.ink : FolioTheme.rule, lineWidth: 1))
            if !mine { Spacer(minLength: 24) }
        }
        .onAppear {
            if autoPlay { play() }
        }
        .onDisappear { stopPlayback() }
    }

    private func toggle() {
        if playing { stopPlayback() } else { play() }
    }

    private func play() {
        guard let url = VoiceAudio.resolve(note) else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try AVAudioSession.sharedInstance().setActive(true)
            let p = try AVAudioPlayer(contentsOf: url)
            p.prepareToPlay()
            p.play()
            player = p
            playing = true
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
                let d = p.duration
                progress = d > 0 ? p.currentTime / d : 0
                if !p.isPlaying {
                    playing = false
                    progress = 0
                    timer?.invalidate()
                }
            }
        } catch {
            playing = false
        }
    }

    private func stopPlayback() {
        player?.stop()
        player = nil
        playing = false
        progress = 0
        timer?.invalidate()
        timer = nil
    }

    private func formatMs(_ ms: Int) -> String {
        let s = max(0, Int((Double(ms) / 1000.0).rounded()))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }
}

enum VoiceAudio {
    static func resolve(_ note: VoiceNote) -> URL? {
        if !note.audioUrl.isEmpty {
            if note.audioUrl.hasPrefix("http://") || note.audioUrl.hasPrefix("https://") {
                return URL(string: note.audioUrl)
            }
            let trimmed = note.audioUrl
                .replacingOccurrences(of: "asset://", with: "")
                .replacingOccurrences(of: "bundle://", with: "")
            let name = (trimmed as NSString).lastPathComponent
            let base = (name as NSString).deletingPathExtension
            let ext = (name as NSString).pathExtension.isEmpty ? "mp3" : (name as NSString).pathExtension
            if let url = Bundle.main.url(forResource: base, withExtension: ext, subdirectory: "voices") {
                return url
            }
            if let url = Bundle.main.url(forResource: base, withExtension: ext) {
                return url
            }
        }
        if !note.audioB64.isEmpty, let data = Data(base64Encoded: note.audioB64) {
            let ext = note.mime.contains("mpeg") ? "mp3" : "m4a"
            let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("\(note.id).\(ext)")
            try? data.write(to: tmp)
            return tmp
        }
        return nil
    }
}
