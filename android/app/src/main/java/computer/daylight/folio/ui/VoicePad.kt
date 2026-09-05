package computer.daylight.folio.ui

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import computer.daylight.folio.ui.theme.Ink
import computer.daylight.folio.ui.theme.Paper
import java.io.File

data class VoiceCapture(val b64: String, val mime: String, val durationMs: Int)

@Composable
fun VoicePad(
    enabled: Boolean,
    onCaptured: (VoiceCapture) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var holding by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var startedAt by remember { mutableStateOf(0L) }
    var file by remember { mutableStateOf<File?>(null) }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    fun stop() {
        val rec = recorder ?: return
        val dur = (System.currentTimeMillis() - startedAt).toInt()
        try {
            rec.stop()
        } catch (_: Exception) {
        }
        rec.release()
        recorder = null
        holding = false
        val f = file ?: return
        if (f.exists() && f.length() > 32) {
            val b64 = Base64.encodeToString(f.readBytes(), Base64.NO_WRAP)
            onCaptured(VoiceCapture(b64, "audio/m4a", dur.coerceAtLeast(200)))
        }
    }

    fun start() {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            perm.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        val out = File(context.cacheDir, "folio-voice.m4a")
        if (out.exists()) out.delete()
        file = out
        val rec = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(64000)
            setAudioSamplingRate(22050)
            setOutputFile(out.absolutePath)
            prepare()
            start()
        }
        recorder = rec
        startedAt = System.currentTimeMillis()
        holding = true
    }

    DisposableEffect(Unit) {
        onDispose {
            recorder?.release()
            recorder = null
        }
    }

    Box(
        modifier
            .size(56.dp)
            .background(if (holding) Ink else Ink.copy(alpha = 0.92f), CircleShape)
            .pointerInput(enabled) {
                detectTapGestures(
                    onPress = {
                        if (!enabled) return@detectTapGestures
                        start()
                        try {
                            awaitRelease()
                        } finally {
                            stop()
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.Mic, contentDescription = "Hold to speak", tint = Paper)
    }
}

fun playAsset(context: android.content.Context, assetPath: String, onDone: () -> Unit = {}): MediaPlayer? {
    return try {
        val path = assetPath.removePrefix("asset://")
        val afd = context.assets.openFd(path)
        MediaPlayer().apply {
            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            setOnCompletionListener {
                it.release()
                onDone()
            }
            prepare()
            start()
        }
    } catch (_: Exception) {
        null
    }
}
