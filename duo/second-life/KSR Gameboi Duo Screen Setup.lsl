// KSR Gameboi Duo - Dual Screen Setup v0.1.0
// Place this script in the ROOT/BODY prim.
// Name the upper display prim TOP SCREEN.
// Name the lower touch display prim TOUCH SCREEN.

string SITE_URL = "https://ksrsl.github.io/gameboi-advanced-sp/duo/";
string SYNC_URL = "https://gameboi-ksr.pages.dev/relay";
string WEB_VERSION = "0.1.0";

integer TOP_SCREEN_FACE = 0;
integer TOUCH_SCREEN_FACE = 0;
integer OWNER_ONLY = TRUE;
integer DEBUG_MODE = FALSE;

integer gTopLink;
integer gTouchLink;
string gRoom;
string gToken;

debug(string message)
{
    if (DEBUG_MODE)
    {
        llOwnerSay("[KSR DUO DEBUG] " + message);
    }
}

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

string residentUsername(key residentId)
{
    string username = llToLower(llGetUsername(residentId));
    if (username != "")
    {
        return username;
    }
    return llToLower(llKey2Name(residentId));
}

string makeScreenURL(string screenName)
{
    key ownerId = llGetOwner();
    string displayName = llGetDisplayName(ownerId);
    if (displayName == "")
    {
        displayName = llKey2Name(ownerId);
    }

    string url = SITE_URL
        + "?v=" + WEB_VERSION
        + "&screen=" + screenName
        + "&device=" + llEscapeURL(gRoom)
        + "&ownerId=" + llEscapeURL((string)ownerId)
        + "&ownerName=" + llEscapeURL(residentUsername(ownerId))
        + "&ownerDisplay=" + llEscapeURL(displayName);

    if (SYNC_URL != "" && gToken != "")
    {
        url += "&sync=" + llEscapeURL(SYNC_URL)
            + "&room=" + llEscapeURL(gRoom)
            + "&token=" + llEscapeURL(gToken);
    }
    return url;
}

integer configureMedia(integer link, integer face, string url,
    integer width, integer height, integer interactPermission)
{
    return llSetLinkMedia(link, face,
    [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, width,
        PRIM_MEDIA_HEIGHT_PIXELS, height,
        PRIM_MEDIA_PERMS_INTERACT, interactPermission,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);
}

configureScreens()
{
    gTopLink = findLink("TOP SCREEN");
    gTouchLink = findLink("TOUCH SCREEN");

    if (gTopLink == 0)
    {
        llOwnerSay("Setup error: name the upper display prim TOP SCREEN.");
        return;
    }
    if (gTouchLink == 0)
    {
        llOwnerSay("Setup error: name the lower display prim TOUCH SCREEN.");
        return;
    }

    integer touchPermission = PRIM_MEDIA_PERM_ANYONE;
    if (OWNER_ONLY)
    {
        touchPermission = PRIM_MEDIA_PERM_OWNER;
    }

    integer topStatus = configureMedia(
        gTopLink,
        TOP_SCREEN_FACE,
        makeScreenURL("top"),
        1200,
        720,
        PRIM_MEDIA_PERM_NONE);

    integer touchStatus = configureMedia(
        gTouchLink,
        TOUCH_SCREEN_FACE,
        makeScreenURL("bottom"),
        960,
        720,
        touchPermission);

    if (topStatus == STATUS_OK && touchStatus == STATUS_OK)
    {
        llOwnerSay("KSR Gameboi Duo screens are online and linked.");
        debug("Top link " + (string)gTopLink
            + " face " + (string)TOP_SCREEN_FACE
            + ", touch link " + (string)gTouchLink
            + " face " + (string)TOUCH_SCREEN_FACE + ".");
    }
    else
    {
        llOwnerSay("KSR Duo media setup failed. Top status "
            + (string)topStatus + ", touch status "
            + (string)touchStatus + ".");
    }
}

loadDeviceIdentity()
{
    gRoom = (string)llGetKey();
    gToken = llLinksetDataRead("ksr_duo_sync_token");
    if (gToken == "")
    {
        gToken = llGetSubString(llSHA1String(
            (string)llGetKey()
            + (string)llGetUnixTime()
            + (string)llGenerateKey()), 0, 31);
        llLinksetDataWrite("ksr_duo_sync_token", gToken);
    }
}

default
{
    state_entry()
    {
        loadDeviceIdentity();
        configureScreens();
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
        if (llDetectedLinkNumber(0) == gTopLink)
        {
            llRegionSayTo(llDetectedKey(0), 0,
                "Use the lower KSR Duo touchscreen to control the system.");
        }
    }
}
