package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.withStyle

/**
 * A card's flavour line as the printed card sets it. Scryfall marks emphasis inside flavour text with *asterisks*; the line is
 * italic, so the marked words stand upright and the asterisks go ("This is *my* domain" reads "This is my domain", "my" upright).
 * A lone asterisk with no partner is kept as it is.
 */
fun flavourText(raw: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < raw.length) {
        val open = raw.indexOf('*', i)
        val close = if (open >= 0) raw.indexOf('*', open + 1) else -1
        if (open < 0 || close < 0 || close == open + 1) { append(raw.substring(i)); break }
        append(raw.substring(i, open))
        withStyle(SpanStyle(fontStyle = FontStyle.Normal)) { append(raw.substring(open + 1, close)) }
        i = close + 1
    }
}
