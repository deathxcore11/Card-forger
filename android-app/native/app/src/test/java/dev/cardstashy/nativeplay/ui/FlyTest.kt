package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Pack finish brief A: the flight's keyframes and timing are the site's (feel.js flyToCollection, style.css nav-pop). */
class FlyTest {
    private fun same(want: Fly.Pose, got: Fly.Pose) {
        assertEquals(want.x, got.x, .01f); assertEquals(want.y, got.y, .01f); assertEquals(want.scale, got.scale, .001f)
        assertEquals(want.rot, got.rot, .001f); assertEquals(want.alpha, got.alpha, .001f)
    }

    @Test fun keyframesEqualTheSite() {
        val dx = 300f; val dy = 900f; val lift = 80f
        same(Fly.Pose(0f, 0f, 1f, 0f, 1f), Fly.pose(0f, dx, dy, lift))
        // { transform: translate(dx*0.35, dy*0.15 - 80) scale(.62) rotate(-8deg), opacity: 1, offset: 0.45 }
        same(Fly.Pose(dx * .35f, dy * .15f - 80f, .62f, -8f, 1f), Fly.poseEased(.45f, dx, dy, lift))
        // { transform: translate(dx, dy) scale(.12) rotate(6deg), opacity: 0.2, offset: 1 }
        same(Fly.Pose(dx, dy, .12f, 6f, .2f), Fly.pose(1f, dx, dy, lift))
        assertEquals(650, Fly.FLIGHT_MS); assertEquals(85L, Fly.GAP_MS); assertEquals(15, Fly.MAX)
        // cubic-bezier(.45,.05,.35,1): slow out of the start, fast through the middle.
        assertEquals(true, Fly.FLIGHT_EASE.transform(.2f) < .2f && Fly.FLIGHT_EASE.transform(.8f) > .8f)
    }

    @Test fun popEqualsNavPop() {
        assertEquals(1f to 0f, Fly.pop(0f))
        val (s35, up35) = Fly.pop(.35f); assertEquals(1.22f, s35, .001f); assertEquals(3f, up35, .001f)
        val (s65, _) = Fly.pop(.65f); assertEquals(.95f, s65, .001f)
        assertEquals(1f, Fly.pop(1f).first, .001f)
        assertEquals(500, Fly.POP_MS); assertEquals(600, Fly.GLOW_MS); assertEquals(420, Fly.RING_MS)
    }
}
