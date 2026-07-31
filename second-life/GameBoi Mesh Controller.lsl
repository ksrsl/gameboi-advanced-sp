// GameBoi Advanced SP - Mesh Controller v1.0
// Put this script in the ROOT prim of the linked console.
// Name the linked prims exactly:
// SCREEN, UP, DOWN, LEFT, RIGHT, A, B, START, SELECT

string MEDIA_URL = "https://ksrsl.github.io/gameboi-advanced-sp/";
integer SCREEN_FACE = 0; // Change this if the media screen uses another face.

integer gScreenLink;
integer gSequence;

integer findLink(string wantedName)
{
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
        llOwnerSay("Setup error: rename the display prim SCREEN.");
        return;
    }

    integer status = llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, MEDIA_URL,
        PRIM_MEDIA_HOME_URL, MEDIA_URL,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        // FALSE preserves the requested non-power-of-two 320 x 240 viewport.
        PRIM_MEDIA_AUTO_SCALE, FALSE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, FALSE,
        PRIM_MEDIA_WIDTH_PIXELS, 320,
        PRIM_MEDIA_HEIGHT_PIXELS, 240,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);

    if (status == STATUS_OK)
    {
        llOwnerSay("GameBoi screen connected. Mesh buttons are ready.");
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
