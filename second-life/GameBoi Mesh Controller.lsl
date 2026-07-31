// KSR Gameboi SP - Open Testing Controller v1.6
// Put this script in the root prim of the linked console.
// Single-prim testing defaults to media face 2.
// Final linked buttons should be named:
// SCREEN, UP, DOWN, LEFT, RIGHT, A, B, START, SELECT

string SITE_URL = "https://ksrsl.github.io/gameboi-advanced-sp/";
string WEB_VERSION = "1.6.0";
integer SCREEN_FACE = 2;

integer gScreenLink;
integer gSequence;
string gMediaURL;

integer findLink(string wantedName)
{
    if (llGetNumberOfPrims() == 1)
    {
        return LINK_THIS;
    }

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
    gMediaURL = SITE_URL + "?v=" + WEB_VERSION;
    gScreenLink = findLink("SCREEN");

    if (gScreenLink == 0)
    {
        llOwnerSay("Setup error: no prim in this linkset is named SCREEN. Use Edit Linked to rename the display prim.");
        return;
    }

    // The viewer's first click frames the complete display prim.
    // Once framed, clicks interact with the Media on a Prim page.
    llSetLinkPrimitiveParamsFast(gScreenLink,
    [
        PRIM_CLICK_ACTION, CLICK_ACTION_ZOOM
    ]);

    integer status = llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, gMediaURL,
        PRIM_MEDIA_HOME_URL, gMediaURL,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        // First click centers the resident's camera; the next click interacts.
        PRIM_MEDIA_FIRST_CLICK_INTERACT, FALSE,
        PRIM_MEDIA_WIDTH_PIXELS, 1024,
        PRIM_MEDIA_HEIGHT_PIXELS, 1024,

        // Open testing: everyone can see and click the media.
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);

    if (status == STATUS_OK)
    {
        llOwnerSay("KSR Gameboi SP ready on face " + (string)SCREEN_FACE + ". First click centers the screen; click again to play.");
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
    string commandURL = gMediaURL
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
