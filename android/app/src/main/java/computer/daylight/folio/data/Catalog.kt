package computer.daylight.folio.data

import android.content.Context
import org.json.JSONObject

object Catalog {
    private var cached: JSONObject? = null

    private fun root(context: Context): JSONObject {
        cached?.let { return it }
        val json = context.assets.open("catalog.json").bufferedReader().use { it.readText() }
        val obj = JSONObject(json)
        cached = obj
        return obj
    }

    fun entries(context: Context): List<CatalogEntry> {
        val arr = root(context).getJSONArray("books")
        return buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    CatalogEntry(
                        id = o.getString("id"),
                        title = o.getString("title"),
                        author = o.getString("author"),
                        year = o.optString("year"),
                        description = o.optString("description"),
                        coverLabel = o.optString("coverLabel"),
                        chapterCount = o.optInt("chapterCount"),
                        wordCount = o.optInt("wordCount"),
                    ),
                )
            }
        }
    }

    fun book(context: Context, id: String): Book? {
        val full = root(context).optJSONObject("full") ?: return null
        val o = full.optJSONObject(id) ?: return null
        val chapters = o.getJSONArray("chapters")
        val list = buildList {
            for (i in 0 until chapters.length()) {
                val c = chapters.getJSONObject(i)
                add(Chapter(c.getString("id"), c.getString("title"), c.getString("html")))
            }
        }
        return Book(
            id = o.getString("id"),
            title = o.getString("title"),
            author = o.getString("author"),
            year = o.optString("year"),
            description = o.optString("description"),
            coverLabel = o.optString("coverLabel"),
            source = o.optString("source", "bundled"),
            chapters = list,
        )
    }
}
