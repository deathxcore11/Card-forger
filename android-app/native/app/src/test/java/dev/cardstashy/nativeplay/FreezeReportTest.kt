package dev.cardstashy.nativeplay

import org.junit.Assert.assertTrue
import org.junit.Test

class FreezeReportTest {
    @Test fun compactPutsNewestStallFirstAndFits() {
        val anr = "== Android froze report (x) ==\nhdr\n" + "y".repeat(20000) + "\n"
        val all = anr + (1..5).joinToString("") { "== Stall sample 1: main busy ${it}000 ms ==\nhdr\n    at a.b.C$it\n\n" }
        val c = FreezeReport.compact(all)
        assertTrue(c, c.startsWith("== Stall sample 1: main busy 5000 ms"))
        assertTrue(c.length <= 7000)
        assertTrue(c.contains("== Android froze report"))
    }
    @Test fun mainThreadFoundWithoutBlankLines() {
        val t = "DALVIK THREADS (2):\n\"Other\" prio=5 tid=6 Waiting\n  at x.Y\n\"main\" prio=5 tid=1 Runnable\n  at dev.cardstashy.Foo.bar(Foo.kt:1)\n\"Next\" prio=5 tid=9\n  at z\n"
        val m = FreezeReport.mainThread(t)
        assertTrue(m, m.contains("Foo.bar") && !m.contains("x.Y"))
    }
    @Test fun oldFullDumpIsCutToMainThread() {
        val daemons = (1..40).joinToString("") { "\"Daemon$it\" daemon prio=5 tid=${it + 5} Waiting\n  at java.lang.Object.wait(Native method)\n\n" }
        val sec = "== Android froze report (x) ==\nCardStashy 0.3.2 · samsung\nInput dispatching timed out\n----- pid 1 -----\nDALVIK THREADS (45):\n" + daemons +
            "\"main\" prio=5 tid=1 Runnable\n  at dev.cardstashy.nativeplay.ui.PlayHomeKt.Today(PlayHome.kt:9)\n\n\"Other\" tid=99\n  at q\n"
        val c = FreezeReport.compact(sec)
        assertTrue(c, c.contains("PlayHome.kt:9") && !c.contains("Daemon3\"") && c.contains("Input dispatching"))
    }
}
