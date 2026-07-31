// KSR Gameboi SP - Sit Camera Focus Fallback v1.0.0
// Reliable standard Second Life camera controller.
// Put this script in the root prim. Do not run it together with the direct
// camera script. It may run beside the GameBoi Mesh Controller media script.

// --------------------------- CONFIGURATION ---------------------------

integer SCREEN_LINK_NUMBER = 1;
integer SCREEN_FACE_NUMBER = 2;

// Set this to the link number of a spare child prim named FOCUS.
// The script automatically places it invisibly over standard box face 2.
// Leave at 0 to use right-click > Enter Game View instead.
integer FOCUS_CATCHER_LINK_NUMBER = 0;

// TRUE lets the focused resident click the screen catcher again to exit.
// It also blocks direct mouse interaction with the web page, so leave this
// TRUE when the game is operated by linked mesh buttons. Set it FALSE if
// residents must click the web page and will use Stand/CAMERA to exit.
integer CATCHER_STAYS_FOR_EXIT = TRUE;

// Optional visible CAMERA button. Set its link number or leave at 0.
integer CAMERA_BUTTON_LINK_NUMBER = 0;

// Standard box face 2 points along local +X.
vector SCREEN_FRONT_LOCAL = <1.0, 0.0, 0.0>;

// Set CAMERA_DISTANCE to 0.0 for automatic tight framing.
float CAMERA_DISTANCE = 0.0;
float CAMERA_HEIGHT = 0.0;
float CAMERA_SIDE_OFFSET = 0.0;
vector FOCUS_OFFSET = <0.0, 0.0, 0.0>;

float MAX_INTERACTION_DISTANCE = 8.0;
float CAMERA_TRANSITION_TIME = 0.65;
float AUTO_FRAME_SCALE = 1.10;
float CAMERA_VERTICAL_FOV = 1.00;
float CAMERA_VIEW_ASPECT = 1.333333;
float CHECK_INTERVAL = 0.50;

// The avatar is seated behind and below the Game Boy while focused.
vector SIT_TARGET_OFFSET = <-0.45, 0.0, -1.15>;
rotation SIT_TARGET_ROTATION = ZERO_ROTATION;

integer DEBUG_MODE = FALSE;

// --------------------------------------------------------------------

key gFocusedUser = NULL_KEY;
integer gCameraActive = FALSE;
integer gObjectPrimCount;
vector gCatcherHomePosition;
vector gCatcherHomeSize;
rotation gCatcherHomeRotation;
vector gLastScreenPosition = ZERO_VECTOR;
rotation gLastScreenRotation = ZERO_ROTATION;

debugMessage(string message)
{
    if (DEBUG_MODE)
    {
        llOwnerSay("[SIT CAMERA DEBUG] " + message);
    }
}

list screenDetails()
{
    return llGetLinkPrimitiveParams(SCREEN_LINK_NUMBER,
    [
        PRIM_POSITION,
        PRIM_ROTATION,
        PRIM_SIZE
    ]);
}

alignFocusCatcher()
{
    if (FOCUS_CATCHER_LINK_NUMBER == 0
        || FOCUS_CATCHER_LINK_NUMBER == SCREEN_LINK_NUMBER)
    {
        return;
    }

    list details = screenDetails();
    list rootDetails = llGetLinkPrimitiveParams(LINK_ROOT,
    [
        PRIM_POSITION,
        PRIM_ROTATION
    ]);

    if (llGetListLength(details) < 3
        || llGetListLength(rootDetails) < 2)
    {
        return;
    }

    vector screenPosition = llList2Vector(details, 0);
    rotation screenRotation = llList2Rot(details, 1);
    vector screenSize = llList2Vector(details, 2);
    vector rootPosition = llList2Vector(rootDetails, 0);
    rotation rootRotation = llList2Rot(rootDetails, 1);
    vector front = llVecNorm(SCREEN_FRONT_LOCAL * screenRotation);

    vector catcherWorldPosition = screenPosition
        + (front * ((screenSize.x * 0.5) + 0.008));

    gCatcherHomePosition = (catcherWorldPosition - rootPosition) / rootRotation;
    gCatcherHomeRotation = screenRotation / rootRotation;
    gCatcherHomeSize = <0.01, screenSize.y, screenSize.z>;

    llSetLinkPrimitiveParamsFast(FOCUS_CATCHER_LINK_NUMBER,
    [
        PRIM_POS_LOCAL, gCatcherHomePosition,
        PRIM_ROT_LOCAL, gCatcherHomeRotation,
        PRIM_SIZE, gCatcherHomeSize,
        PRIM_COLOR, ALL_SIDES, <1.0, 1.0, 1.0>, 0.0,
        PRIM_CLICK_ACTION, CLICK_ACTION_SIT
    ]);
}

setCatcherMode(integer focused)
{
    if (FOCUS_CATCHER_LINK_NUMBER == 0
        || FOCUS_CATCHER_LINK_NUMBER == SCREEN_LINK_NUMBER)
    {
        return;
    }

    if (focused && !CATCHER_STAYS_FOR_EXIT)
    {
        llSetLinkPrimitiveParamsFast(FOCUS_CATCHER_LINK_NUMBER,
        [
            PRIM_POS_LOCAL, gCatcherHomePosition + <0.0, 0.0, -10.0>,
            PRIM_SIZE, <0.01, 0.01, 0.01>,
            PRIM_CLICK_ACTION, CLICK_ACTION_TOUCH
        ]);
    }
    else
    {
        integer clickAction = CLICK_ACTION_SIT;
        if (focused)
        {
            clickAction = CLICK_ACTION_TOUCH;
        }

        llSetLinkPrimitiveParamsFast(FOCUS_CATCHER_LINK_NUMBER,
        [
            PRIM_POS_LOCAL, gCatcherHomePosition,
            PRIM_ROT_LOCAL, gCatcherHomeRotation,
            PRIM_SIZE, gCatcherHomeSize,
            PRIM_COLOR, ALL_SIDES, <1.0, 1.0, 1.0>, 0.0,
            PRIM_CLICK_ACTION, clickAction
        ]);
    }
}

setCameraButtonMode(integer focused)
{
    if (CAMERA_BUTTON_LINK_NUMBER == 0)
    {
        return;
    }

    integer clickAction = CLICK_ACTION_SIT;
    if (focused)
    {
        clickAction = CLICK_ACTION_TOUCH;
    }

    llSetLinkPrimitiveParamsFast(CAMERA_BUTTON_LINK_NUMBER,
    [
        PRIM_CLICK_ACTION, clickAction
    ]);
}

integer applyCamera()
{
    list details = screenDetails();
    if (llGetListLength(details) < 3)
    {
        return FALSE;
    }

    vector screenPosition = llList2Vector(details, 0);
    rotation screenRotation = llList2Rot(details, 1);
    vector screenSize = llList2Vector(details, 2);

    vector front = llVecNorm(SCREEN_FRONT_LOCAL * screenRotation);
    vector side = <0.0, 1.0, 0.0> * screenRotation;
    vector up = <0.0, 0.0, 1.0> * screenRotation;
    vector focusPoint = screenPosition + (FOCUS_OFFSET * screenRotation);

    float distance = CAMERA_DISTANCE;
    if (distance <= 0.0)
    {
        float halfFovTangent = llTan(CAMERA_VERTICAL_FOV * 0.5);
        if (halfFovTangent < 0.1)
        {
            halfFovTangent = 0.1;
        }

        float aspect = CAMERA_VIEW_ASPECT;
        if (aspect < 0.1)
        {
            aspect = 1.333333;
        }

        float heightDistance = (screenSize.z * 0.5) / halfFovTangent;
        float widthDistance = (screenSize.y * 0.5)
            / (halfFovTangent * aspect);

        distance = heightDistance;
        if (widthDistance > distance)
        {
            distance = widthDistance;
        }
        distance *= AUTO_FRAME_SCALE;
    }

    float clippingDistance = (screenSize.x * 0.5) + 0.12;
    if (distance < clippingDistance)
    {
        distance = clippingDistance;
    }

    vector cameraPosition = focusPoint
        + (front * distance)
        + (up * CAMERA_HEIGHT)
        + (side * CAMERA_SIDE_OFFSET);

    float positionLag = CAMERA_TRANSITION_TIME;
    if (positionLag < 0.0)
    {
        positionLag = 0.0;
    }
    if (positionLag > 3.0)
    {
        positionLag = 3.0;
    }

    float focusLag = positionLag * 0.55;

    llClearCameraParams();
    llSetCameraParams(
    [
        CAMERA_ACTIVE, TRUE,
        CAMERA_POSITION, cameraPosition,
        CAMERA_POSITION_LOCKED, TRUE,
        CAMERA_POSITION_LAG, positionLag,
        CAMERA_POSITION_THRESHOLD, 0.0,
        CAMERA_FOCUS, focusPoint,
        CAMERA_FOCUS_LOCKED, TRUE,
        CAMERA_FOCUS_LAG, focusLag,
        CAMERA_FOCUS_THRESHOLD, 0.0
    ]);

    gLastScreenPosition = screenPosition;
    gLastScreenRotation = screenRotation;

    debugMessage("camera=" + (string)cameraPosition
        + " focus=" + (string)focusPoint
        + " distance=" + (string)distance);
    return TRUE;
}

integer userIsNear(key user)
{
    list avatarDetails = llGetObjectDetails(user, [OBJECT_POS]);
    list details = screenDetails();

    if (llGetListLength(avatarDetails) == 0
        || llGetListLength(details) < 3)
    {
        return FALSE;
    }

    vector avatarPosition = llList2Vector(avatarDetails, 0);
    vector screenPosition = llList2Vector(details, 0);
    return llVecDist(avatarPosition, screenPosition) <= MAX_INTERACTION_DISTANCE;
}

clearFocusedState()
{
    gFocusedUser = NULL_KEY;
    gCameraActive = FALSE;
    llSetTimerEvent(0.0);
    setCatcherMode(FALSE);
    setCameraButtonMode(FALSE);
}

leaveGameView(string message, integer standUser)
{
    key user = gFocusedUser;

    if (gCameraActive
        && llGetPermissionsKey() == gFocusedUser
        && (llGetPermissions() & PERMISSION_CONTROL_CAMERA))
    {
        llClearCameraParams();
    }

    if (user != NULL_KEY && message != "")
    {
        llRegionSayTo(user, 0, message);
    }

    if (standUser && user != NULL_KEY)
    {
        llUnSit(user);
    }
    clearFocusedState();
}

ejectOtherSitters()
{
    integer link = gObjectPrimCount + 1;
    integer totalLinks = llGetNumberOfPrims();

    while (link <= totalLinks)
    {
        key candidate = llGetLinkKey(link);
        if (candidate != NULL_KEY
            && candidate != gFocusedUser
            && llGetAgentSize(candidate) != ZERO_VECTOR)
        {
            llRegionSayTo(candidate, 0, "Game Boy is currently in use.");
            llUnSit(candidate);
        }
        ++link;
    }
}

handleSeatChange()
{
    key sitter = llAvatarOnSitTarget();

    if (sitter != NULL_KEY)
    {
        if (gFocusedUser == NULL_KEY)
        {
            gFocusedUser = sitter;
            setCatcherMode(TRUE);
            setCameraButtonMode(TRUE);
            llRegionSayTo(sitter, 0, "Entering Game View");
            llRequestPermissions(sitter, PERMISSION_CONTROL_CAMERA);
        }
        else if (sitter != gFocusedUser)
        {
            llRegionSayTo(sitter, 0, "Game Boy is currently in use.");
            llUnSit(sitter);
        }
        ejectOtherSitters();
        return;
    }

    if (gFocusedUser != NULL_KEY)
    {
        clearFocusedState();
    }
}

setup()
{
    gObjectPrimCount = llGetObjectPrimCount(llGetKey());
    llSetSitText("Enter Game View");
    llSitTarget(SIT_TARGET_OFFSET, SIT_TARGET_ROTATION);
    alignFocusCatcher();
    setCameraButtonMode(FALSE);

    gFocusedUser = llAvatarOnSitTarget();
    if (gFocusedUser != NULL_KEY)
    {
        setCatcherMode(TRUE);
        setCameraButtonMode(TRUE);
        llRequestPermissions(gFocusedUser, PERMISSION_CONTROL_CAMERA);
    }

    debugMessage("Sit camera fallback ready.");
}

default
{
    state_entry()
    {
        setup();
    }

    on_rez(integer startParameter)
    {
        if (gFocusedUser != NULL_KEY)
        {
            leaveGameView("Camera restored because the Game Boy reset.", TRUE);
        }
        llResetScript();
    }

    attach(key attachedAvatar)
    {
        if (attachedAvatar == NULL_KEY && gFocusedUser != NULL_KEY)
        {
            leaveGameView("Camera restored because the Game Boy was detached.", TRUE);
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            if (gFocusedUser != NULL_KEY)
            {
                leaveGameView("Camera restored because ownership changed.", TRUE);
            }
            llResetScript();
            return;
        }

        if (change & CHANGED_REGION_START)
        {
            if (gFocusedUser != NULL_KEY)
            {
                leaveGameView("Camera restored because the region restarted.", TRUE);
            }
        }

        if (change & CHANGED_LINK)
        {
            integer currentPrimCount = llGetObjectPrimCount(llGetKey());
            if (currentPrimCount != gObjectPrimCount)
            {
                setup();
            }
            else
            {
                handleSeatChange();
                if (gFocusedUser != NULL_KEY)
                {
                    ejectOtherSitters();
                }
            }
        }
    }

    run_time_permissions(integer permissions)
    {
        if (gFocusedUser == NULL_KEY
            || llGetPermissionsKey() != gFocusedUser)
        {
            return;
        }

        if (permissions & PERMISSION_CONTROL_CAMERA)
        {
            gCameraActive = TRUE;
            if (applyCamera())
            {
                string exitMessage = "Game View ready. Use Stand or the CAMERA button to exit.";
                if (CATCHER_STAYS_FOR_EXIT
                    && FOCUS_CATCHER_LINK_NUMBER != 0)
                {
                    exitMessage = "Game View ready. Click the screen again to exit.";
                }
                llRegionSayTo(gFocusedUser, 0, exitMessage);
                llSetTimerEvent(CHECK_INTERVAL);
            }
            else
            {
                leaveGameView("Camera focus could not be calculated.", TRUE);
            }
        }
        else
        {
            leaveGameView("Camera permission was denied.", TRUE);
        }
    }

    touch_start(integer detected)
    {
        integer index = 0;
        while (index < detected)
        {
            integer touchedLink = llDetectedLinkNumber(index);
            integer exitControl = FALSE;

            if (CAMERA_BUTTON_LINK_NUMBER != 0
                && touchedLink == CAMERA_BUTTON_LINK_NUMBER)
            {
                exitControl = TRUE;
            }
            if (CATCHER_STAYS_FOR_EXIT
                && FOCUS_CATCHER_LINK_NUMBER != 0
                && touchedLink == FOCUS_CATCHER_LINK_NUMBER)
            {
                exitControl = TRUE;
            }

            if (exitControl)
            {
                key toucher = llDetectedKey(index);
                if (gCameraActive && toucher == gFocusedUser)
                {
                    leaveGameView("Leaving Game View", TRUE);
                }
                else if (gFocusedUser != NULL_KEY && toucher != gFocusedUser)
                {
                    llRegionSayTo(toucher, 0, "Game Boy is currently in use.");
                }
            }
            ++index;
        }
    }

    timer()
    {
        if (!gCameraActive || gFocusedUser == NULL_KEY)
        {
            llSetTimerEvent(0.0);
            return;
        }

        if (llGetAgentSize(gFocusedUser) == ZERO_VECTOR)
        {
            clearFocusedState();
            return;
        }

        if (!userIsNear(gFocusedUser))
        {
            leaveGameView("Game View closed because you moved too far away.", TRUE);
            return;
        }

        list details = screenDetails();
        if (llGetListLength(details) < 3)
        {
            leaveGameView("Game View closed because the screen is unavailable.", TRUE);
            return;
        }

        vector screenPosition = llList2Vector(details, 0);
        rotation screenRotation = llList2Rot(details, 1);

        if (screenPosition != gLastScreenPosition
            || screenRotation != gLastScreenRotation)
        {
            applyCamera();
        }
    }
}
