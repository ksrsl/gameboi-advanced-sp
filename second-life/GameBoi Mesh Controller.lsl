// KSR Gameboi SP - Low-Latency Mesh Controller v1.7.0
// Put this script in the ROOT/BODY prim of the linked console.
// Name the display child prim SCREEN. The current display uses face 2.
// Name the controls UP, DOWN, LEFT, RIGHT, A, B, START, SELECT.
//
// This version opens one secure long-poll bridge when the console starts.
// Button presses no longer navigate/reload the media URL one press at a time.

string SITE_URL = "https://ksrsl.github.io/gameboi-advanced-sp/";
string WEB_VERSION = "2.3.0";
integer SCREEN_FACE = 2;
integer DEBUG_MODE = FALSE;

integer gScreenLink;
integer gSequence;
integer gBridgeReady;
key gUrlRequest;
string gBridgeURL;
string gBridgeToken;
string gMediaURL;

// Event history uses strides of: sequence, button name, pressed.
list gHistory;
integer MAX_HISTORY_EVENTS = 48;

// Pending browser polls are stored in matching lists.
list gPendingIds;
list gPendingAfter;

debug(string message)
{
    if (DEBUG_MODE)
    {
        llOwnerSay("[GAMEBOI BUTTON DEBUG] " + message);
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

    if (count == 1)
    {
        return LINK_THIS;
    }
    return 0;
}

integer isButtonName(string buttonName)
{
    return llListFindList(
        ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT"],
        [buttonName]) != -1;
}

string queryValue(string query, string wantedName)
{
    list fields = llParseStringKeepNulls(query, ["&"], []);
    integer count = llGetListLength(fields);
    integer index = 0;

    while (index < count)
    {
        string field = llList2String(fields, index);
        integer equals = llSubStringIndex(field, "=");
        if (equals != -1)
        {
            string name = llGetSubString(field, 0, equals - 1);
            if (name == wantedName)
            {
                return llUnescapeURL(llGetSubString(field, equals + 1, -1));
            }
        }
        ++index;
    }
    return "";
}

configureScreen()
{
    gScreenLink = findLink("SCREEN");
    if (gScreenLink == 0)
    {
        llOwnerSay("Setup error: no prim in this linkset is named SCREEN.");
        return;
    }

    gMediaURL = SITE_URL + "?v=" + WEB_VERSION;
    if (gBridgeURL != "" && gBridgeToken != "")
    {
        gMediaURL += "&bridge=" + llEscapeURL(gBridgeURL)
            + "&bridgeToken=" + gBridgeToken;
    }

    integer status = llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, gMediaURL,
        PRIM_MEDIA_HOME_URL, gMediaURL,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, 1024,
        PRIM_MEDIA_HEIGHT_PIXELS, 1024,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);

    if (status == STATUS_OK)
    {
        if (gBridgeURL != "")
        {
            gBridgeReady = TRUE;
            llOwnerSay("KSR Gameboi SP FAST buttons ready on SCREEN face "
                + (string)SCREEN_FACE + ".");
        }
        else
        {
            llOwnerSay("KSR Gameboi SP media ready, but fast buttons are unavailable.");
        }
    }
    else
    {
        gBridgeReady = FALSE;
        llOwnerSay("Media setup failed. Status: " + (string)status);
    }
}

string bridgePage(integer afterSequence)
{
    string html = "<!doctype html><meta charset='utf-8'><script>"
        + "parent.postMessage({source:'ksr-gameboi-bridge',token:'"
        + gBridgeToken + "',seq:" + (string)gSequence + ",events:[";

    integer count = llGetListLength(gHistory);
    integer index = 0;
    integer added = 0;

    while (index < count)
    {
        integer sequence = llList2Integer(gHistory, index);
        if (sequence > afterSequence)
        {
            string buttonName = llList2String(gHistory, index + 1);
            integer pressed = llList2Integer(gHistory, index + 2);
            string booleanText = "false";
            if (pressed)
            {
                booleanText = "true";
            }

            if (added)
            {
                html += ",";
            }
            html += "{seq:" + (string)sequence
                + ",key:'" + buttonName
                + "',down:" + booleanText + "}";
            ++added;
        }
        index += 3;
    }

    html += "]},'*');</script>";
    return html;
}

respondBridge(key requestId, integer afterSequence)
{
    llSetContentType(requestId, CONTENT_TYPE_HTML);
    llHTTPResponse(requestId, 200, bridgePage(afterSequence));
}

deliverPending()
{
    integer count = llGetListLength(gPendingIds);
    integer index = count - 1;

    while (index >= 0)
    {
        key requestId = llList2Key(gPendingIds, index);
        integer afterSequence = llList2Integer(gPendingAfter, index);
        respondBridge(requestId, afterSequence);
        gPendingIds = llDeleteSubList(gPendingIds, index, index);
        gPendingAfter = llDeleteSubList(gPendingAfter, index, index);
        --index;
    }
}

rememberInput(string buttonName, integer pressed)
{
    ++gSequence;
    gHistory += [gSequence, llToLower(buttonName), pressed];

    integer extra = llGetListLength(gHistory) - (MAX_HISTORY_EVENTS * 3);
    if (extra > 0)
    {
        gHistory = llDeleteSubList(gHistory, 0, extra - 1);
    }

    debug(buttonName + " " + (string)pressed + " sequence " + (string)gSequence);
    deliverPending();
}

sendLegacyButton(string buttonName)
{
    string commandURL = gMediaURL
        + "#input=" + llToLower(buttonName)
        + "&seq=" + (string)gSequence;

    llSetLinkMedia(gScreenLink, SCREEN_FACE,
    [
        PRIM_MEDIA_CURRENT_URL, commandURL
    ]);
}

sendButton(string buttonName, integer pressed)
{
    rememberInput(buttonName, pressed);

    if (!gBridgeReady && pressed)
    {
        sendLegacyButton(buttonName);
    }
}

requestBridgeURL()
{
    gBridgeReady = FALSE;
    gPendingIds = [];
    gPendingAfter = [];
    gHistory = [];
    gSequence = 0;

    if (gBridgeURL != "")
    {
        llReleaseURL(gBridgeURL);
        gBridgeURL = "";
    }

    gBridgeToken = llGetSubString(
        llSHA1String((string)llGetKey() + (string)llGetUnixTime()), 0, 19);
    gUrlRequest = llRequestSecureURL();
    llOwnerSay("Preparing low-latency Gameboi buttons...");
}

handleTouches(integer detected, integer pressed)
{
    integer index = 0;

    while (index < detected)
    {
        integer touchedLink = llDetectedLinkNumber(index);
        string buttonName = llToUpper(llGetLinkName(touchedLink));

        if (isButtonName(buttonName))
        {
            sendButton(buttonName, pressed);
        }
        ++index;
    }
}

default
{
    state_entry()
    {
        requestBridgeURL();
        llSetTimerEvent(15.0);
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
        else if (change & CHANGED_REGION_START)
        {
            requestBridgeURL();
        }
    }

    http_request(key requestId, string method, string body)
    {
        if (requestId == gUrlRequest)
        {
            if (method == URL_REQUEST_GRANTED)
            {
                gBridgeURL = body;
                configureScreen();
            }
            else
            {
                gBridgeURL = "";
                gBridgeToken = "";
                llOwnerSay("Fast-button bridge was denied. Falling back to slow controls.");
                configureScreen();
            }
            return;
        }

        if (method != "GET")
        {
            llHTTPResponse(requestId, 405, "Method not allowed");
            return;
        }

        string query = llGetHTTPHeader(requestId, "x-query-string");
        if (queryValue(query, "token") != gBridgeToken || gBridgeToken == "")
        {
            llHTTPResponse(requestId, 403, "Forbidden");
            return;
        }

        integer afterSequence = (integer)queryValue(query, "after");
        if (afterSequence < gSequence)
        {
            respondBridge(requestId, afterSequence);
        }
        else
        {
            gPendingIds += [requestId];
            gPendingAfter += [afterSequence];
        }
    }

    timer()
    {
        // Complete idle polls before the simulator times them out.
        deliverPending();
    }

    touch_start(integer detected)
    {
        handleTouches(detected, TRUE);
    }

    touch_end(integer detected)
    {
        handleTouches(detected, FALSE);
    }
}
