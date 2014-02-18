#pragma strict

var started = false;
var butw = 250;
var buth = 25;
var margin = 10;
var ip : String = "127.0.0.1";
var port = 25000;
var aboutToBeClient = false;

function Awake()
{
	Network.minimumAllocatableViewIDs = 100;
}

function Start()
{
	DontDestroyOnLoad(this);
}

function OnGUI()
{
	if (!Network.isClient && !Network.isServer && !started)
    {
    	var x = Screen.width*0.5 - butw*0.5;
    	var y = Screen.height * 0.55 - buth*0.5;
	    /*if (GUI.Button(Rect(100, 100, 250, 50), "Start Server"))
            StartServer();*/
        
        if (GUI.Button(Rect(x,y,butw,buth), "Singleplayer"))
        {
        	started = true;
        	Application.LoadLevel("scene");
        }
        
        if (GUI.Button(Rect(x,y+buth+margin,butw,buth), "Host Server"))
        {
        	started = true;
        	
        	// 4 players, port 25000, NAT not supported yet
        	Network.InitializeServer(4, port, false);
        	Debug.Log("server host started, port " + port);
        	Application.LoadLevel("scene");
        }
        
        ip = GUI.TextField(Rect(x+butw*0.5,y+(buth+margin)*2,butw*0.5,buth),ip);
        if (GUI.Button(Rect(x,y+(buth+margin)*2,butw*0.5,buth), "Connect"))
        {
        	started = true;
        	Debug.Log("attempting to connect to " + ip);
        	Application.LoadLevel("scene");
        	aboutToBeClient = true;
        	Network.Connect(ip, port);
        }
    }
}

// only called on the client
function OnConnectedToServer()
{
	Debug.Log("connected to server");
}

// called on the client and on the server when a client cleanly disconnects
function OnDisconnectedFromServer(info : NetworkDisconnection)
{
	if (!Network.isServer)
	{
		Debug.Log("disconnected");
		aboutToBeClient = false;
		started = false;
		Screen.lockCursor = false;
		Application.LoadLevel("splashscreen");
		Destroy(this);
	}
}

// called on the client
function OnFailedToConnect(error: NetworkConnectionError)
{
	Debug.Log("Could not connect to server: "+ error);
	aboutToBeClient = false;
	started = false;
	Screen.lockCursor = false;
	Application.LoadLevel("splashscreen");
	Destroy(this);
}

// called on the server
function OnPlayerConnected(player: NetworkPlayer) 
{
	Debug.Log("Player connected from " + player.ipAddress + 
              ":" + player.port);
}

// called on the server
function OnPlayerDisconnected(player: NetworkPlayer)
{
	Debug.Log("Clean up after player " +  player);
	Network.RemoveRPCs(player);
	//Network.DestroyPlayerObjects(player); // we do this manually with RPCs on all clients
	
	GameObject.Find("LevelObject").GetComponent(NetworkView).RPC("DestroyRemotePlayerObjects", RPCMode.All, player);
}
