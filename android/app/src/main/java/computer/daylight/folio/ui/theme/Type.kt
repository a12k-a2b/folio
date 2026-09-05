package computer.daylight.folio.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Serif = FontFamily.Serif
val Ui = FontFamily.SansSerif

val TypePx = intArrayOf(20, 23, 26, 30)

fun pageStyle(typeScale: Int, leading: Float, justify: Boolean): TextStyle {
    val px = TypePx.getOrElse(typeScale.coerceIn(0, 3)) { 23 }
    return TextStyle(
        fontFamily = Serif,
        fontWeight = FontWeight.Normal,
        fontSize = px.sp,
        lineHeight = (px * leading).sp,
        color = Ink,
        fontStyle = FontStyle.Normal,
    )
}

val UiLabel = TextStyle(
    fontFamily = Ui,
    fontWeight = FontWeight.Medium,
    fontSize = 11.sp,
    letterSpacing = 1.6.sp,
    color = InkSoft,
)
