To try the working copy in Thunderbird:

1. Open `about:debugging` in Thunderbird.
2. Select **This Thunderbird**.
3. Click **Load Temporary Add-on...** and select this project's `manifest.json`.
4. Open the Kanban board from the toolbar button or the **Tools** menu.

The temporary add-on is unloaded when Thunderbird closes, so repeat these steps
after restarting. Check **Tools > Developer Tools > Error Console** if it fails
to load or the board does not work.

The manifest currently declares support through Thunderbird 153.x. This only
allows installation on those versions; the add-on's calendar experiment APIs
still need to be tested there.

To build a release XPI from a tagged commit, use:
```
git archive --format=zip -o incanban-tag.xpi tag
```
