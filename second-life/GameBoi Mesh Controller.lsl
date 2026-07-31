// KSR Gameboi SP - Mesh Controller v1.2
// Put this script in the ROOT prim of the linked console.
// Name the linked prims exactly:
// SCREEN, UP, DOWN, LEFT, RIGHT, A, B, START, SELECT

string MEDIA_URL = "https://ksrsl.github.io/gameboi-advanced-sp/";
integer SCREEN_FACE = 2;

integer gScreenLink;
integer gSequence;

integer findLink(string wantedName)
{
    // A one-prim test screen is always the media target.
    if (llGetNumberOfPrims() == 1)
    {
        return LINK_THIS;
    }

    // llGetLinkName(1) does not reliably address an unlinked root prim.
    // Because this script belongs in the root, LINK_THIS safely covers both
    // a single-prim screen and a linked root prim named SCREEN.
    if (llToUpper(llGetObjectName()) == llToUpper(wantedName))
    {
        return LINK_THIS;
    }

    integer count = llGetNumberOfPrims();
    integer link = 1;

    while (link <= count)
    {
        if (llToUpper(llGetLinkName(link)) == llToUpper(wantedName))
        {
            return link;
        }
        ++link;
    }
    return 0;
}

configureScreen()
{
    gScreenLink = findLink("SCREEN");

    if (gScreenLink == 0)
    {
        llOwnerSay("Setup error: no prim in this linkset is named SCREEN. Use Edit Linked to rename the display prim, not only the whole object.");
        return;
    }

    integer status = llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, MEDIA_URL,
        PRIM_MEDIA_HOME_URL, MEDIA_URL,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        // Render at 1024 x 768 for a sharp 4:3 Media-on-a-Prim display.
        PRIM_MEDIA_AUTO_SCALE, FALSE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, FALSE,
        PRIM_MEDIA_WIDTH_PIXELS, 1024,
        PRIM_MEDIA_HEIGHT_PIXELS, 768,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);

    if (status == STATUS_OK)
    {
        if (llGetNumberOfPrims() == 1)
        {
            llOwnerSay("Screen connected. Now link the mesh buttons into this same object so they can control it.");
        }
        else
        {
            llOwnerSay("GameBoi screen connected. Mesh buttons are ready.");
        }
    }
    else
    {
        llOwnerSay("Media setup failed. Status: " + (string)status);
    }
}

sendButton(string buttonName)
{
    if (gScreenLink == 0)
    {
        configureScreen();
        if (gScreenLink == 0) return;
    }

    ++gSequence;
    string commandURL = MEDIA_URL
        + "#input=" + llToLower(buttonName)
        + "&seq=" + (string)gSequence;

    integer status = llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, commandURL
    ]);

    if (status != STATUS_OK)
    {
        llOwnerSay("Button command failed. Status: " + (string)status);
    }
}

default
{
    state_entry()
    {
        configureScreen();
    }

    on_rez(integer startParameter)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & (CHANGED_LINK | CHANGED_OWNER))
        {
            llResetScript();
        }
    }

    touch_start(integer detected)
    {
        integer index = 0;

        while (index < detected)
        {
            integer touchedLink = llDetectedLinkNumber(index);
            string buttonName = llToUpper(llGetLinkName(touchedLink));

            if (llListFindList(
                ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT"],
                [buttonName]) != -1)
            {
                sendButton(buttonName);
            }
            ++index;
        }
    }
}
