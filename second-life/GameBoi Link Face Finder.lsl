// KSR Gameboi SP - Link and Face Finder
// Temporarily add this script to the root prim, then touch a non-media face.

default
{
    state_entry()
    {
        llOwnerSay("Link/face finder ready. Touch the part you want to identify.");
    }

    touch_start(integer detected)
    {
        integer index = 0;
        while (index < detected)
        {
            integer link = llDetectedLinkNumber(index);
            integer face = llDetectedTouchFace(index);
            string name = llGetLinkName(link);

            llOwnerSay("Name: " + name
                + " | Link: " + (string)link
                + " | Face: " + (string)face);
            ++index;
        }
    }
}
