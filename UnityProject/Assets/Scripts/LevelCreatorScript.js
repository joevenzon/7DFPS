#pragma strict

var level_tiles : GameObject[];
var shadowed_lights : Array;
var tiles : Array;
var tileVariants : Array;
var levelInstances : Array;
var aboutToBeClient : boolean = false;

@RPC
function SpawnEnemy(instanceIndex : int, levelIndex : int, enemyIndex : int, position : Vector3, rotation : Quaternion, netViewID : NetworkViewID)
{
	var level_obj = level_tiles[levelIndex];
	var level = levelInstances[instanceIndex] as GameObject;
	
	var enemies = level_obj.transform.FindChild("enemies");
	if(enemies){
		var curEnemyIndex : int = 0;
		for(var child : Transform in enemies){
			if(curEnemyIndex == enemyIndex){
				var child_obj = Instantiate(child.gameObject, position, rotation);
				child_obj.transform.parent = level.transform;
				
				child_obj.tag = "Robot";
				
				var nView : NetworkView;
				nView = child_obj.GetComponent(NetworkView);
				nView.viewID = netViewID;
			}
			curEnemyIndex++;
		}
	}
}

@RPC
function SpawnRemotePlayer(instanceIndex : int, levelIndex : int, playerIndex : int, position : Vector3, rotation : Quaternion, netViewID : NetworkViewID)
{
	Debug.Log("SpawnRemotePlayer " + instanceIndex + "," + levelIndex + "," + playerIndex);

	var level_obj = level_tiles[levelIndex];
	var level = levelInstances[instanceIndex] as GameObject;
	
	var players = level_obj.transform.FindChild("player_spawn");
	if(players){
		var j=0;
		for(var child : Transform in players){
			if(j == playerIndex){
				var child_obj = Instantiate(child.gameObject, position, child.localRotation);
				child_obj.transform.parent = level.transform;
				child_obj.name = "Remote Player";
				child_obj.tag = "Player";
				
				var nView : NetworkView;
				nView = child_obj.GetComponent(NetworkView);
				nView.viewID = netViewID;
			}
			++j;
		}
	}
}

@RPC
function DestroyRemotePlayerObjects(player : NetworkPlayer)
{
	var players = GameObject.FindGameObjectsWithTag("Player");
	for (var p : GameObject in players)
	{
		if (p.GetComponent(NetworkView).networkView.owner == player)
		{
			Debug.Log("destroying remote player object " + p.name);
			Destroy(p);
		}
	}
}

@RPC
function SpawnTileOnClient(where : int, levelIndex : int, tileIndex : int, player : boolean, challenge : float, itemMask : String)
{
	Debug.Log("SpawnTileOnClient: " + where + "," + levelIndex + "," + tileIndex);
	
	var idx:int = 0;
	for(var tile:int in tiles){
		if(tile == where){
			throw ("duplicate tile creation RPC at " + where + " cli:" + tileVariants[idx] + " srv:" + levelIndex);
		}
		idx++;
	}
	if (tileIndex != tiles.length || tileIndex != tileVariants.length || tileIndex != levelInstances.length) throw ("mismatch between client/server level tile indices: cli:" + tiles.length + "/" + tileVariants.length + "/" + levelInstances.length + " srv:" + tileIndex);

	var level_obj = level_tiles[levelIndex];
	var level = new GameObject(level_obj.name + " (Clone)");
	for (var child : Transform in level_obj.transform){
		if(child.gameObject.name != "enemies" && child.gameObject.name != "player_spawn" && child.gameObject.name != "items"){
			var child_obj = Instantiate(child.gameObject, Vector3(0,0,where*20) + child.localPosition, child.localRotation);
			child_obj.transform.parent = level.transform;
		}
	}
	
	// all loot is local and client-authoritative
	var items = level_obj.transform.FindChild("items");
	var itemIdx = 0;
	if(items){
		if (itemMask.length != items.childCount) throw ("mismatch between client/server item counts: " + items.childCount + "/" + itemMask.length);
		for(var child : Transform in items){
			//if(Random.Range(0.0,1.0) <= (player?challenge+0.3:challenge)){
			if (itemMask[itemIdx] == "1")
			{
				child_obj = Instantiate(child.gameObject, Vector3(0,0,where*20) + child.localPosition + items.localPosition, items.localRotation);
				child_obj.transform.parent = level.transform;
			}
			itemIdx++;
		}
	}
	
	// spawn the local player and tell everyone else about it
	if(player)
	{
		var players = level_obj.transform.FindChild("player_spawn");
		if(players){
			var num = 0;
			for(var child : Transform in players){
				++num;
			}
			var save = Random.Range(0,num);
			var j=0;
			for(var child : Transform in players){
				if(j == save){
					var position = Vector3(0,0,where*20) + child.localPosition + players.localPosition;
					child_obj = Instantiate(child.gameObject, position, child.localRotation);
					child_obj.transform.parent = level.transform;
					child_obj.name = "Player";
					child_obj.tag = "Player";
					child_obj.transform.Find("Graphics").GetComponent(MeshRenderer).enabled = false;
					
					var netViewID = Network.AllocateViewID();
					var nView : NetworkView;
					nView = child_obj.GetComponent(NetworkView);
					nView.viewID = netViewID;
					
					this.networkView.RPC("SpawnRemotePlayer", RPCMode.OthersBuffered, tileIndex, levelIndex, save, position, child.localRotation, netViewID);
				}
				++j;
			}
		}
	}
	
	level.transform.parent = this.gameObject.transform;
	
	/*var lights = GetComponentsInChildren(Light);
	for(var light : Light in lights){
		if(light.enabled && light.shadows == LightShadows.Hard){
			shadowed_lights.push(light);
		}
	}*/
	
	tiles.push(where);
	tileVariants.push(levelIndex);
	levelInstances.push(level);
}

function SpawnTile(where:int, challenge:float , player:boolean)
{
	if (Network.isClient || aboutToBeClient) return;
	
	var levelIndex = Random.Range(0,level_tiles.Length);
	//levelIndex = 1;
	var level_obj = level_tiles[levelIndex];
	var level = new GameObject(level_obj.name + " (Clone)");
	
	var tileIndex = tiles.length;
	tiles.push(where);
	tileVariants.push(levelIndex);
	levelInstances.push(level);
	
	// spawn non-gameplay elements
	for (var child : Transform in level_obj.transform){
		if(child.gameObject.name != "enemies" && child.gameObject.name != "player_spawn" && child.gameObject.name != "items"){
			var child_obj = Instantiate(child.gameObject, Vector3(0,0,where*20) + child.localPosition, child.localRotation);
			child_obj.transform.parent = level.transform;
		}
	}
	
	// spawn items
	var items = level_obj.transform.FindChild("items");
	var itemMask : String = ""; // using a string as bitmask is wasteful, but i don't want to try and figure out how bit operations work in javascript
	if(items){
		for(var child : Transform in items){
			if(Random.Range(0.0,1.0) <= (player?challenge+0.3:challenge)){
				child_obj = Instantiate(child.gameObject, Vector3(0,0,where*20) + child.localPosition + items.localPosition, items.localRotation);
				child_obj.transform.parent = level.transform;
				itemMask = String.Concat(itemMask,"1");
			}
			else
			{
				itemMask = String.Concat(itemMask,"0");
			}
		}
	}
	
	if (Network.isServer)
		this.networkView.RPC("SpawnTileOnClient", RPCMode.OthersBuffered, where, levelIndex, tileIndex, player, challenge, itemMask);
	
	var enemies = level_obj.transform.FindChild("enemies");
	if(enemies){
		var enemyIndex : int = 0;
		for(var child : Transform in enemies){
			if(Random.Range(0.0,1.0) <= challenge){
				var position = Vector3(0,0,where*20) + child.localPosition + enemies.localPosition;
				child_obj = Instantiate(child.gameObject, position, child.localRotation);
				child_obj.transform.parent = level.transform;
				
				child_obj.tag = "Robot";
				var netViewID = Network.AllocateViewID();
				var nView : NetworkView;
				nView = child_obj.GetComponent(NetworkView);
				nView.viewID = netViewID;
				
				if (Network.isServer)
					this.networkView.RPC("SpawnEnemy", RPCMode.OthersBuffered, tileIndex, levelIndex, enemyIndex, position, child.localRotation, netViewID);
			}
			enemyIndex++;
		}
	}
	
	if(player){
		var players = level_obj.transform.FindChild("player_spawn");
		if(players){
			var num = 0;
			for(var child : Transform in players){
				++num;
			}
			var save = Random.Range(0,num);
			var j=0;
			for(var child : Transform in players){
				if(j == save){
					position = Vector3(0,0,where*20) + child.localPosition + players.localPosition;
					child_obj = Instantiate(child.gameObject, position, child.localRotation);
					child_obj.transform.parent = level.transform;
					child_obj.name = "Player";
					child_obj.tag = "Player";
					child_obj.transform.Find("Graphics").GetComponent(MeshRenderer).enabled = false;
					netViewID = Network.AllocateViewID();
					nView = child_obj.GetComponent(NetworkView);
					nView.viewID = netViewID;
					
					if (Network.isServer)
						this.networkView.RPC("SpawnRemotePlayer", RPCMode.OthersBuffered, tileIndex, levelIndex, save, position, child.localRotation, netViewID);
				}
				++j;
			}
		}
	}
	level.transform.parent = this.gameObject.transform;
	
	var lights = GetComponentsInChildren(Light);
	for(var light : Light in lights){
		if(light.enabled && light.shadows == LightShadows.Hard){
			shadowed_lights.push(light);
		}
	}
}

function Start () 
{
	shadowed_lights = new Array();
	tiles = new Array();
	tileVariants = new Array();
	levelInstances = new Array();
	
	aboutToBeClient = GameObject.Find("NetworkingObject").GetComponent(NetworkManager).aboutToBeClient;
	
	if (!Network.isClient && !aboutToBeClient)
	{
		SpawnTile(0,0.0,true);
		for(var i=-3; i <= 3; ++i){
			CreateTileIfNeeded(i);
		}
	}
}

function CreateTileIfNeeded(which:int)
{
	if (Network.isClient || aboutToBeClient) return;

	var found = false;
	for(var tile:int in tiles){
		if(tile == which){
			found = true;
		}
	}
	if(!found){
		//Debug.Log("Spawning tile: "+which);
		SpawnTile(which, Mathf.Min(0.6,0.1 * Mathf.Abs(which)), false);
	}
}

function Update () 
{
	if (Network.isClient || aboutToBeClient) return;
	
	var players = GameObject.FindGameObjectsWithTag("Player");
	for (var p : GameObject in players)
	{
		var tile_x : int = p.GetComponent(Transform).transform.position.z / 20.0 + 0.5;
		
		for(var i=-2; i <= 2; ++i){
			CreateTileIfNeeded(tile_x+i);
		}
	}
	
	var main_camera = GameObject.Find("Main Camera").transform;
	for(var light : Light in shadowed_lights){
		if(!light){
			Debug.Log("LIGHT IS MISSING");
		}
		if(light){
			var shadowed_amount = Vector3.Distance(main_camera.position, light.gameObject.transform.position);
			var shadow_threshold = Mathf.Min(30,light.range*2.0);
			var fade_threshold = shadow_threshold * 0.75;
			if(shadowed_amount < shadow_threshold){
				light.shadows = LightShadows.Hard;
				light.shadowStrength = Mathf.Min(1.0, 1.0-(fade_threshold - shadowed_amount) / (fade_threshold - shadow_threshold));
			} else {
				light.shadows = LightShadows.None;
			}
		}
	}
}
