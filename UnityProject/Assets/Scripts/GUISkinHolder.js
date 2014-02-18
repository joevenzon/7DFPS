#pragma strict

var gui_skin:GUISkin;
var sound_scream : AudioClip[];
var sound_tape_content : AudioClip[];
var sound_tape_start : AudioClip;
var sound_tape_end : AudioClip;
var sound_tape_background : AudioClip;
var tape_object : GameObject;
var win_sting : AudioClip;
var weapons : GameObject[];
var weapon : GameObject;
var flashlight_object : GameObject;
var has_flashlight = false;
var weaponIndex : int = 0;

function Awake () {
	//weapon = weapons[2];
	weaponIndex = Random.Range(0,weapons.length);
	weapon = weapons[weaponIndex];
}

function Start () {
}

function Update () {
}