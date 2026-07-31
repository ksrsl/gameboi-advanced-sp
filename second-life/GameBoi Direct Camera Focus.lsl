// KSR Gameboi SP - Direct Camera Focus v1.0.0
// Attempts camera control while the resident remains standing.
// IMPORTANT: Standard Second Life normally grants PERMISSION_CONTROL_CAMERA
// only while the object is worn or the resident is seated. Use the separate
// sit-target fallback script when the direct permission request is denied.

// --------------------------- CONFIGURATION ---------------------------

integer SCREEN_LINK_NUMBER = 2;
integer SCREEN_FACE_NUMBER = 2;

// Leave at 0 to use SCREEN_LINK_NUMBER as the click trigger.
// For Media on a Prim, set this to a separate CAMERA button or click-catcher
// link because a Shared Media face does not generate LSL touch events.
integer CLICK_TRIGGER_LINK_NUMBER = 0;
integer CLICK_TRIGGER_FACE_NUMBER = ALL_SIDES;

// Standard box face 2 points along local +X.
vector SCREEN_FRONT_LOCAL = <1.0, 0.0, 0.0>;

// Set VIEW_DISTANCE to 0.0 for automatic tight framing.
float VIEW_DISTANCE = 0.0;
float CAMERA_HEIGHT = 0.0;
float CAMERA_SIDE_OFFSET = 0.0;
vector FOCUS_OFFSET = <0.0, 0.0, 0.0>;

float MAX_INTERACTION_DISTANCE = 8.0;
float CAMERA_TRANSITION_TIME = 0.65;
float AUTO_FRAME_SCALE = 1.10;
float CAMERA_VERTICAL_FOV = 1.00;
float CAMERA_VIEW_ASPECT = 1.333333;
float CHECK_INTERVAL = 0.50;

integer DEBUG_MODE = FALSE;

// --------------------------------------------------------------------

key gFocusedUser = NULL_KEY;
key gPendingUser = NULL_KEY;
integer gCameraActive = FALSE;
vector gLastScreenPosition = ZERO_VECTOR;
rotation gLastScreenRotation = ZERO_ROTATION;

debugMessage(string message)
{
    if (DEBUG_MODE)
    {
        llOwnerSay("[CAMERA DEBUG] " + message);
    }
}

integer linkMatches(integer detectedLink, integer configuredLink)
{
    if (detectedLink == configuredLink)
    {
        return TRUE;
    }

    if (llGetObjectPrimCount(llGetKey()) == 1)
    {
        if ((detectedLink == 0 || detectedLink == 1)
            && (configuredLink == 0
                || configuredLink == 1
                || configuredLink == LINK_ROOT
                || configuredLink == LINK_THIS))
        {
            return TRUE;
        }
    }
    return FALSE;
}

integer isCameraTouch(integer detectedIndex)
{
    integer wantedLink = SCREEN_LINK_NUMBER;
    integer wantedFace = SCREEN_FACE_NUMBER;

    if (CLICK_TRIGGER_LINK_NUMBER != 0)
    {
        wantedLink = CLICK_TRIGGER_LINK_NUMBER;
        wantedFace = CLICK_TRIGGER_FACE_NUMBER;
    }

    if (!linkMatches(llDetectedLinkNumber(detectedIndex), wantedLink))
    {
        return FALSE;
    }

    if (wantedFace != ALL_SIDES
        && llDetectedTouchFace(detectedIndex) != wantedFace)
    {
        return FALSE;
    }
    return TRUE;
}

list screenDetails()
{
    integer screenLink = SCREEN_LINK_NUMBER;
    if (llGetObjectPrimCount(llGetKey()) == 1)
    {
        screenLink = LINK_THIS;
    }

    return llGetLinkPrimitiveParams(screenLink,
    [
        PRIM_POSITION,
        PRIM_ROTATION,
        PRIM_SIZE
    ]);
}

integer userIsNear(key user)
{
    list avatarDetails = llGetObjectDetails(user, [OBJECT_POS]);
    if (llGetListLength(avatarDetails) == 0)
    {
        return FALSE;
    }

    list details = screenDetails();
    if (llGetListLength(details) < 3)
    {
        return FALSE;
    }

    vector avatarPosition = llList2Vector(avatarDetails, 0);
    vector screenPosition = llList2Vector(details, 0);
    return llVecDist(avatarPosition, screenPosition) <= MAX_INTERACTION_DISTANCE;
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

    float distance = VIEW_DISTANCE;
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

releaseCamera(string message)
{
    key user = gFocusedUser;

    if (gCameraActive
        && llGetPermissionsKey() == gFocusedUser
        && (llGetPermissions() & PERMISSION_CONTROL_CAMERA))
    {
        llClearCameraParams();
    }

    gFocusedUser = NULL_KEY;
    gPendingUser = NULL_KEY;
    gCameraActive = FALSE;
    llSetTimerEvent(0.0);

    if (user != NULL_KEY && message != "")
    {
        llRegionSayTo(user, 0, message);
    }
}

requestCamera(key user)
{
    if (!userIsNear(user))
    {
        llRegionSayTo(user, 0, "Move closer to the Game Boy screen.");
        return;
    }

    gPendingUser = user;
    llRegionSayTo(user, 0, "Entering Game View");
    llRequestPermissions(user, PERMISSION_CONTROL_CAMERA);
}

default
{
    state_entry()
    {
        gFocusedUser = NULL_KEY;
        gPendingUser = NULL_KEY;
        gCameraActive = FALSE;
        llSetTimerEvent(0.0);
        debugMessage("Direct camera controller ready.");
    }

    on_rez(integer startParameter)
    {
        releaseCamera("");
        llResetScript();
    }

    attach(key attachedAvatar)
    {
        if (attachedAvatar == NULL_KEY)
        {
            releaseCamera("Camera restored because the Game Boy was detached.");
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            releaseCamera("Camera restored because ownership changed.");
            llResetScript();
            return;
        }

        if (change & (CHANGED_LINK | CHANGED_REGION_START))
        {
            releaseCamera("Camera restored because the Game Boy changed.");
        }
    }

    touch_start(integer detected)
    {
        integer index = 0;
        while (index < detected)
        {
            if (isCameraTouch(index))
            {
                key toucher = llDetectedKey(index);

                if (gCameraActive)
                {
                    if (toucher == gFocusedUser)
                    {
                        releaseCamera("Leaving Game View");
                    }
                    else
                    {
                        llRegionSayTo(toucher, 0, "Game Boy is currently in use.");
                    }
                }
                else if (gPendingUser != NULL_KEY)
                {
                    if (toucher != gPendingUser)
                    {
                        llRegionSayTo(toucher, 0, "Game Boy is currently in use.");
                    }
                }
                else
                {
                    requestCamera(toucher);
                }
            }
            ++index;
        }
    }

    run_time_permissions(integer permissions)
    {
        key permissionUser = llGetPermissionsKey();

        if (gPendingUser == NULL_KEY || permissionUser != gPendingUser)
        {
            return;
        }

        if (permissions & PERMISSION_CONTROL_CAMERA)
        {
            if (!userIsNear(gPendingUser))
            {
                key distantUser = gPendingUser;
                gPendingUser = NULL_KEY;
                llRegionSayTo(distantUser, 0, "Camera request cancelled because you moved too far away.");
                return;
            }

            gFocusedUser = gPendingUser;
            gPendingUser = NULL_KEY;
            gCameraActive = TRUE;

            llClearCameraParams();
            if (applyCamera())
            {
                llRegionSayTo(gFocusedUser, 0, "Click the screen again to exit.");
                llSetTimerEvent(CHECK_INTERVAL);
            }
            else
            {
                releaseCamera("Camera focus could not be calculated.");
            }
        }
        else
        {
            key deniedUser = gPendingUser;
            gPendingUser = NULL_KEY;
            llRegionSayTo(deniedUser, 0, "Direct camera permission was unavailable. Use the sit-target camera fallback.");
        }
    }

    timer()
    {
        if (!gCameraActive)
        {
            llSetTimerEvent(0.0);
            return;
        }

        if (llGetAgentSize(gFocusedUser) == ZERO_VECTOR)
        {
            releaseCamera("");
            return;
        }

        if (!userIsNear(gFocusedUser))
        {
            releaseCamera("Game View closed because you moved too far away.");
            return;
        }

        list details = screenDetails();
        if (llGetListLength(details) < 3)
        {
            releaseCamera("Game View closed because the screen is unavailable.");
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
