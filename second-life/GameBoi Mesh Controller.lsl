// KSR Gameboi SP - Open Testing Controller v1.6.1
// Put this script in the root prim of the linked console.
// Single-prim testing defaults to media face 2.
// Final linked buttons should be named:
// SCREEN, UP, DOWN, LEFT, RIGHT, A, B, START, SELECT
// Optional camera button name: CAMERA
// For one-left-click focus over Media on a Prim, add a child prim named FOCUS.
// The script sizes, aligns, and hides it over display face 2 automatically.

string SITE_URL = "https://ksrsl.github.io/gameboi-advanced-sp/";
string WEB_VERSION = "1.6.0";
integer SCREEN_FACE = 2;

// Face 2 on a standard box points along local +X.
// For a custom mesh facing the other way, change this to <-1.0, 0.0, 0.0>.
vector CAMERA_FRONT_LOCAL = <1.0, 0.0, 0.0>;

// Places the seated resident behind and below the display.
vector CAMERA_SEAT_OFFSET = <-0.45, 0.0, -1.15>;
rotation CAMERA_SEAT_ROTATION = ZERO_ROTATION;

float CAMERA_DISTANCE_SCALE = 1.15;
float CAMERA_MIN_DISTANCE = 1.20;
float CAMERA_MOVE_LAG = 0.65;
float CAMERA_AIM_LAG = 0.35;

integer gScreenLink;
integer gCameraLink;
integer gFocusLink;
integer gObjectPrimCount;
integer gSequence;
key gCameraUser = NULL_KEY;
string gMediaURL;
vector gFocusHomePosition;
vector gFocusHomeSize;
rotation gFocusHomeRotation;

integer findLink(string wantedName)
{
    integer count = llGetNumberOfPrims();

    if (count == 1)
    {
        if (llToUpper(wantedName) == "SCREEN")
        {
            return LINK_THIS;
        }

        if (llToUpper(llGetObjectName()) == llToUpper(wantedName))
        {
            return LINK_THIS;
        }
        return 0;
    }

    if (llToUpper(llGetObjectName()) == llToUpper(wantedName))
    {
        return LINK_THIS;
    }

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

alignFocusCatcher()
{
    if (gFocusLink == 0 || gFocusLink == gScreenLink)
    {
        return;
    }

    list screenDetails = llGetLinkPrimitiveParams(gScreenLink,
    [
        PRIM_POSITION,
        PRIM_ROTATION,
        PRIM_SIZE
    ]);
    list rootDetails = llGetLinkPrimitiveParams(LINK_ROOT,
    [
        PRIM_POSITION,
        PRIM_ROTATION
    ]);

    vector screenPosition = llList2Vector(screenDetails, 0);
    rotation screenRotation = llList2Rot(screenDetails, 1);
    vector screenSize = llList2Vector(screenDetails, 2);
    vector rootPosition = llList2Vector(rootDetails, 0);
    rotation rootRotation = llList2Rot(rootDetails, 1);
    vector front = llVecNorm(CAMERA_FRONT_LOCAL * screenRotation);

    vector focusWorldPosition = screenPosition
        + (front * ((screenSize.x * 0.5) + 0.008));

    gFocusHomePosition = (focusWorldPosition - rootPosition) / rootRotation;
    gFocusHomeRotation = screenRotation / rootRotation;
    gFocusHomeSize = <0.01, screenSize.y, screenSize.z>;

    llSetLinkPrimitiveParamsFast(gFocusLink,
    [
        PRIM_POS_LOCAL, gFocusHomePosition,
        PRIM_ROT_LOCAL, gFocusHomeRotation,
        PRIM_SIZE, gFocusHomeSize,
        PRIM_COLOR, ALL_SIDES, <1.0, 1.0, 1.0>, 0.0,
        PRIM_CLICK_ACTION, CLICK_ACTION_SIT
    ]);
}

moveFocusCatcher(integer hidden)
{
    if (gFocusLink == 0 || gFocusLink == gScreenLink)
    {
        return;
    }

    if (hidden)
    {
        llSetLinkPrimitiveParamsFast(gFocusLink,
        [
            PRIM_POS_LOCAL, gFocusHomePosition + <0.0, 0.0, -10.0>,
            PRIM_SIZE, <0.01, 0.01, 0.01>,
            PRIM_CLICK_ACTION, CLICK_ACTION_TOUCH
        ]);
    }
    else
    {
        llSetLinkPrimitiveParamsFast(gFocusLink,
        [
            PRIM_POS_LOCAL, gFocusHomePosition,
            PRIM_ROT_LOCAL, gFocusHomeRotation,
            PRIM_SIZE, gFocusHomeSize,
            PRIM_COLOR, ALL_SIDES, <1.0, 1.0, 1.0>, 0.0,
            PRIM_CLICK_ACTION, CLICK_ACTION_SIT
        ]);
    }
}

setFocusMode(integer focused)
{
    if (gScreenLink != 0)
    {
        // The media face always receives clicks directly; no magnifier step.
        llSetLinkPrimitiveParamsFast(gScreenLink,
        [
            PRIM_CLICK_ACTION, CLICK_ACTION_TOUCH
        ]);

        llSetLinkMedia(gScreenLink, SCREEN_FACE,
        [
            PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE
        ]);
    }

    moveFocusCatcher(focused);

    if (gCameraLink != 0 && gCameraLink != gScreenLink)
    {
        integer cameraClickAction = CLICK_ACTION_SIT;
        if (focused)
        {
            cameraClickAction = CLICK_ACTION_TOUCH;
        }

        llSetLinkPrimitiveParamsFast(gCameraLink,
        [
            PRIM_CLICK_ACTION, cameraClickAction
        ]);
    }
}

focusCamera()
{
    if (gCameraUser == NULL_KEY || gScreenLink == 0)
    {
        return;
    }

    list screenDetails = llGetLinkPrimitiveParams(gScreenLink,
    [
        PRIM_POSITION,
        PRIM_ROTATION,
        PRIM_SIZE
    ]);

    vector screenPosition = llList2Vector(screenDetails, 0);
    rotation screenRotation = llList2Rot(screenDetails, 1);
    vector screenSize = llList2Vector(screenDetails, 2);
    vector front = llVecNorm(CAMERA_FRONT_LOCAL * screenRotation);

    float largestSide = screenSize.y;
    if (screenSize.z > largestSide)
    {
        largestSide = screenSize.z;
    }

    float cameraDistance = largestSide * CAMERA_DISTANCE_SCALE;
    if (cameraDistance < CAMERA_MIN_DISTANCE)
    {
        cameraDistance = CAMERA_MIN_DISTANCE;
    }

    vector cameraPosition = screenPosition + (front * cameraDistance);

    llClearCameraParams();
    llSetCameraParams(
    [
        CAMERA_ACTIVE, TRUE,
        CAMERA_POSITION, cameraPosition,
        CAMERA_POSITION_LOCKED, TRUE,
        CAMERA_POSITION_LAG, CAMERA_MOVE_LAG,
        CAMERA_POSITION_THRESHOLD, 0.0,
        CAMERA_FOCUS, screenPosition,
        CAMERA_FOCUS_LOCKED, TRUE,
        CAMERA_FOCUS_LAG, CAMERA_AIM_LAG,
        CAMERA_FOCUS_THRESHOLD, 0.0
    ]);
}

handleSeatChange()
{
    key sitter = llAvatarOnSitTarget();

    if (sitter != NULL_KEY)
    {
        if (sitter != gCameraUser)
        {
            gCameraUser = sitter;
            setFocusMode(TRUE);
            llRequestPermissions(gCameraUser, PERMISSION_CONTROL_CAMERA);
        }
        return;
    }

    if (gCameraUser != NULL_KEY)
    {
        gCameraUser = NULL_KEY;
        setFocusMode(FALSE);
    }
}

configureScreen()
{
    gMediaURL = SITE_URL + "?v=" + WEB_VERSION;
    gScreenLink = findLink("SCREEN");
    gCameraLink = findLink("CAMERA");
    gFocusLink = findLink("FOCUS");
    gObjectPrimCount = llGetObjectPrimCount(llGetKey());

    if (gScreenLink == 0)
    {
        llOwnerSay("Setup error: no prim in this linkset is named SCREEN. Use Edit Linked to rename the display prim.");
        return;
    }

    llSetSitText("Focus Screen");
    llSitTarget(CAMERA_SEAT_OFFSET, CAMERA_SEAT_ROTATION);
    alignFocusCatcher();

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

        // Open testing: everyone can see and click the media.
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE
    ]);

    gCameraUser = llAvatarOnSitTarget();
    setFocusMode(gCameraUser != NULL_KEY);

    if (gCameraUser != NULL_KEY)
    {
        llRequestPermissions(gCameraUser, PERMISSION_CONTROL_CAMERA);
    }

    if (status == STATUS_OK)
    {
        if (gFocusLink != 0 && gFocusLink != gScreenLink)
        {
            llOwnerSay("KSR Gameboi SP ready on face " + (string)SCREEN_FACE + ". Click the screen once for smooth centered focus, then click again to play.");
        }
        else
        {
            llOwnerSay("KSR Gameboi SP ready on face " + (string)SCREEN_FACE + ". Single-prim focus: right-click and choose Focus Screen. Link a child prim named FOCUS for one-left-click focus.");
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
        if (gScreenLink == 0)
        {
            return;
        }
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
        if (change & CHANGED_OWNER)
        {
            llResetScript();
            return;
        }

        if (change & CHANGED_LINK)
        {
            integer currentPrimCount = llGetObjectPrimCount(llGetKey());
            if (currentPrimCount != gObjectPrimCount)
            {
                configureScreen();
            }
            else
            {
                handleSeatChange();
            }
        }
    }

    run_time_permissions(integer permissions)
    {
        if ((permissions & PERMISSION_CONTROL_CAMERA)
            && llGetPermissionsKey() == gCameraUser)
        {
            focusCamera();
            llRegionSayTo(gCameraUser, 0, "Screen centered. Click to play. Use Stand when you are finished.");
        }
        else if (gCameraUser != NULL_KEY)
        {
            key deniedUser = gCameraUser;
            llRegionSayTo(deniedUser, 0, "Camera focus could not start.");
            llUnSit(deniedUser);
        }
    }

    touch_start(integer detected)
    {
        integer index = 0;

        while (index < detected)
        {
            integer touchedLink = llDetectedLinkNumber(index);
            string buttonName = llToUpper(llGetLinkName(touchedLink));

            if (buttonName == "CAMERA" && llDetectedKey(index) == gCameraUser)
            {
                llUnSit(gCameraUser);
            }
            else if (llListFindList(
                ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT"],
                [buttonName]) != -1)
            {
                sendButton(buttonName);
            }
            ++index;
        }
    }
}
