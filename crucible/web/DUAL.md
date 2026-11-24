# Lost Memories on two screens

This is for whoever builds the native app that shows Lost Memories on a handheld with two displays, one above the
other. The game page draws both screens itself. The host only has to put each one on its own display and pass the
pad's keys in.

## Turning it on

Open the game page with `?dual=1` in its address. Without it the page is the one-frame console look, unchanged.

In this mode the page draws two frames:

| Frame  | Size in frame pixels | What it is for |
|--------|----------------------|----------------|
| top    | 640 x 360            | The place: the room and its painting, or the hall and the whole duel table. |
| bottom | 413 x 360            | What you hold and decide: the hand or the deck, the relics, the plaques. |

A frame pixel is always a whole number of device pixels, the same number for both frames, the largest at which the
pair fits the window (3 at 1920 x 2160, 2 at 1280 x 1440, 1 at 640 x 720). Nothing is ever smoothed.

## The hook

When the mode is on, the page sets `window.LM_DUAL`:

- `top`, `bottom`: the two elements. Each holds one whole screen and nothing else, and cuts off what leaves it.
- `frames`: `{ top: [640, 360], bottom: [413, 360] }`, the frames' sizes in frame pixels.
- `rects()`: where each frame stands in the window now, in device pixels, as `{ top: [x, y, w, h], bottom: [x, y, w, h],
  scale }`. `scale` is the number of device pixels to a frame pixel.
- `press(key)`: press a pad key by its name (the names are listed below). Use it when the host reads the pad itself.
- `walk()`: for tests. Says which controls the d-pad cannot reach from where the cursor stands, and from which it
  could not come back. Both lists are empty on every screen.

## Putting each frame on its own display

In a browser window the page stacks the frames: the top one at the window's top, the bottom one centred under it.
Rows the window has left over, 16 at the most, lie between them as the hinge.

On a device with two displays there are two ways to do it.

1. One web view across both displays. Make the view as wide as the top display and as tall as both displays, with
   the hinge between them left out or no taller than 16 frame pixels. The page then lays the frames out as above:
   the top frame fills the top display, the bottom frame sits centred on the bottom one. On a top display of
   1920 x 1080 and a bottom display 1240 wide, the frames come out at 3 device pixels to the frame pixel, 1920 x 1080
   and 1239 x 1080.
2. Two surfaces. Keep one web view, read `LM_DUAL.rects()`, and show the `top` rectangle of it on the top display and
   the `bottom` rectangle on the bottom one, each at its own size with no scaling. Send a touch on either display back
   to the web view at the same point of the same rectangle.

Do not scale either frame by anything but a whole number, and scale both by the same number. If the bottom display's
pixels are smaller than the top one's, the bottom frame simply looks a little smaller in the hand.

## How input arrives

Touch: every plaque, card, relic, door, plinth and row on both frames can be tapped. A tap also moves the cursor to
what was tapped.

Pad: the page reads the standard pad of the Gamepad API by itself. If the host's web view does not pass the pad
through, read it in the host and call `LM_DUAL.press(name)` once for each press (and again while a direction is held,
if you want it to repeat).

| Pad                 | Name for `press`              | What it does |
|---------------------|-------------------------------|--------------|
| D-pad, left stick   | `up` `down` `left` `right`    | Moves the one cursor to the nearest control that way, on either frame. Left and right stay in the row; up and down cross the hinge. |
| A (button 0)        | `A`                           | Presses what the cursor is on. On a card already chosen it presses the lit plaque, so A chooses a card and A again plays it. |
| B (button 1)        | `B`                           | Back or undo: the plaque with the B chip. Puts away a card or relic being read, and puts back a card picked up at the Anvil or in the deck book before it leaves. Where B would walk away from a room and what it offers (TAKE NOTHING, LEAVE), the first press only says so and the second one goes. |
| X (button 2)        | `X`                           | The screen's other main action: the plaque with the X chip (END TURN in a duel). |
| Y (button 3)        | `Y`                           | Look closer: the plaque with the Y chip (THIS DUEL, the deck or the relics). |
| L1, R1 (4, 5)       | `L1` `R1`                     | The one before and the next one: doors, choices, Traps, books. In a duel with no such plaque they jump between the hand, your row and the rival's row. |
| L2, R2, right stick | `L2` `R2`                     | Page up and down: the list the cursor is in, else long text, else another list with rows out of sight. |
| Start (button 9)    | `START`                       | The menu. Pressed again, or in a book, it shuts the menu or the book. |
| Select              |                               | Not used. |

A key does only what a plaque on the screen says it does: each plaque that has a key shows the key on a chip at its
left, and no key is shown twice. The plaque A presses is the lit one, and it shows the A chip: at its left where it has
a chip's room, else inside it at its right end. A plaque with a key of its own keeps that key's chip when the hammer
is on it. A key with a chip presses its plaque and leaves the cursor where it was.

When the cursor is on a card, a relic or a row and no plaque stands for what A does there, one plaque says it in its
own words (CHOOSE CARD, READ IT ABOVE, OPEN THE BOOK, SWITCH IT) and lights: in a duel the first plaque of the foot is
kept for this; elsewhere the screen's first plaque gives its place for as long as the cursor stays there, and only for
a pad (a finger has pressed the thing itself). Where A does nothing new (a card already read on its page), no plaque
lights.

Where the cursor starts: on the first card of your hand at the start of each of your turns, on the first card of the
deck at the Anvil and in the deck book, on the chosen door, plinth or row elsewhere. It never starts on a plaque that
goes back, leaves or ends a turn, so a stray A does none of those.

The cursor is the hammer on a plaque. On a card the card's own frame turns light; on a relic or a row its border does.
A small marker also stands over a hand card, a monster, a door or a plinth, and only where its nine by six pixels lie
on nothing: no number, word, card or picture. The cursor is never lost: when the control it was on goes away, it waits
on the screen's own place, and what the page reads goes there with it.

A list that holds more rows than it shows has a small gold marker pointing to the rows out of sight (in the left margin
of a grid of cards, after the heading of a list of rows). The d-pad walks into every such list, L2 and R2 page it, and
a finger drags it.

## The keyboard, for a desk

| Key                         | Pad key |
|-----------------------------|---------|
| Arrow keys                  | D-pad   |
| Enter, Space, Z             | A       |
| Escape, Backspace, B        | B       |
| X                           | X       |
| Y, C                        | Y       |
| Q, E                        | L1, R1  |
| Page Up, Page Down, [ and ] | L2, R2  |
| M                           | Start   |

## What stands where

- Title: the painting above; the menu below, with a panel that says what the choice under the hammer opens.
- A chamber: the hall and its doors above with the chosen door read whole; below, what each door costs and gives,
  your strongest cards and the plaques.
- A duel: the hall and the whole table above, with both duelists' plates and the bar of words, which only tells the
  fight; below, the hand in six places that never move (a card played leaves its place empty, a card drawn takes the
  first empty place, sliding out whole from under the deck pile; the page counts a hand card by where it stands,
  left to right, and a turn opens with the cursor on the leftmost), the deck and the graveyard, the page of whatever the cursor is on, the relics and the plaques.
  Both graveyards can be listed: yours beside the hand, the rival's on the rival's plate. While a hand card is chosen
  the page stays on a card (the one under the cursor on the hand or the table, else the chosen one) and says at its
  foot what choosing it means, so the walk down through the relics to DEFENSE POS, SET VEILED, SCRAP CARD or the
  Forger's Power never takes the card being played off its page. With nothing chosen, L1 and R1 stand in the foot as
  ROW BEFORE and NEXT ROW. An attack that waits on an answer and the duel's end take the page's place below; the
  question shows your Trap in a gold box and what happens without it in a box beside it. Nothing covers the table.
- A room with choices: the room and its plinths above with the chosen thing read whole; below, what it would join
  (the deck as a grid of whole cards, forty to a frame where the plaques leave five rows; the relics you hold by name
  over the deck; the kit's cards; the trunk).
- The Anvil and the Winnower: the room above with the chosen card shown large; the whole deck below, forty cards whole.
- The deck book: the page of the card under the cursor above, with the trunk beside it and what the deck is made of;
  the whole deck below. Up from the first row of the deck crosses to the trunk.
- The other books (the relics, the rules, the options, the Codex, the Feats, the Vault): the open page above, the list
  below. L1 and R1 turn to the next book.
- A question (the menu, leaving, the heat's rules, this duel): the bottom frame only. The top frame holds still until
  it is answered.
- A story, and the card of a new floor: the painting in the room's window above with the words under it, where the
  letters are largest; below, what you carry into what comes next.

## Checks

`CC_DUAL=1 node tools/crucible/console-checks.cjs <page url> <saves folder> [pad keys]` reads both frames of every
screen against the rules of the look, and against the rules of this layout: nothing said on both frames, no large
bare square on either (what is drawn is counted, not the window it is drawn in), every line of words on a whole frame
pixel and none cut through at the foot of its box, every control reached by the d-pad, the table and the hand's six
places fixed through a duel, the cursor's own drawing over no word, number or picture, a marker on every list with rows
out of sight (and L2 and R2 paging it), the duel's page on the card being played, and the A chip on the lit plaque.

Not assessed: a real two-screen handheld, a real pad, and how fast it draws there.
