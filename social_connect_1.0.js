window.SocialConnect = (function() {

var LOOKUP_COMMAND      = "LU";
var CONNECT_COMMAND     = "HI";
var DISCONNECT_COMMAND  = "BY";
var ALREADY_CONNECTED   = "ALREADY_CONNECTED";

var MAX_CHUNK_SIZE      = 300;
var COMMAND_SIZE        = 2;

function SocialConnect( domainaddr, rendevousaddr ){
    
    var self = this;
    self._me_stream = null;
    self._domain_addr = domainaddr;
    self._rendevous_addr = rendevousaddr;
    self._connected = false;
    self._connecting = false;
    self._fetching = false;
    self._connected_friends = [];
    self._connected_friends_streams = {};
    self._friends = [];
    self._chunks = [];
    self._chunks_index = 0;
    self._chunks_fetched = 0;
    self._servicetag = "";
}

SocialConnect.prototype.connect = function( id, friends, servicetag ){
    
    if( id.length > 2 && this._connecting == false && this._connected == false ){
        
        var self = this;
        
        this._connecting = true;
			
		// check if id has servicetag already
		if( id.substr(0, servicetag.length ) != servicetag ){
			this._userid = servicetag + id;
		}else{
			this._userid = id;
		}
			
		// add service tag in not added already
		for( var i = 0, l = friends.length; i < l; i++ ){
			if( friends.hasOwnProperty( i ) ){
				if( friends[i].id.substr(0, servicetag.length ) != servicetag ){
					friends[i].id = servicetag + friends[i].id;
				}
			}
		}
			
		this._friends = friends;
		this._servicetag = servicetag;
		this._connecting = true;

		this._me_stream = new HydnaStream( this._rendevous_addr, 'we', this._userid );
		
		this._me_stream.onerror = function( evt ){
		    // handle errors
		    if( evt.error.message == ALREADY_CONNECTED ){
		        self.handleAlreadyConnected();
		    }
		    
		}
		
		this._me_stream.onsignal = function( msg, flag ){
		    self.handleUserSignal( msg, flag );
	    }
	    
		this._me_stream.onopen = function(){
		    self.handleUserOpen();
	    }

		return true;
	}
		
	return false;
}

SocialConnect.prototype.handleAlreadyConnected = function(){
    
    this.onalreadyconnected && this.onalreadyconnected();
    
}

SocialConnect.prototype.handleUserOpen = function(){
    
    this._connecting = false;
	
	if( !this._connected ){
	
		this._connected = true;
	
		this.lookup();	
	}
    
}

SocialConnect.prototype.handleUserSignal = function( msg, flag ){
	
	if( msg.length >= COMMAND_SIZE ){
	
        var type = msg.substr( 0, COMMAND_SIZE );
	
		var data = '';
	
		if( msg.length > COMMAND_SIZE ){
			data = msg.substr( COMMAND_SIZE, msg.length );
		}
	
		switch( type ){
		
			case LOOKUP_COMMAND:
			
			    this._chunks_fetched++;
			
				if( data.length > 0 ){
					
					var raw = data.split( ",");

					for( var i = 0, l = raw.length; i < l; i++  ){
				
						var keyval = raw[i].split("=");
				
						this._connected_friends.push( { id: keyval[0], stream: keyval[1] } );

					}
			
					if( this._chunks_fetched == this._chunks.length ){
					    
					    this.lookupComplete();
					}
					
				}else{
				    
				    if( this._chunks_fetched == this._chunks.length ){
					
					    this.lookupComplete();
				    }
					
				}
			
			break;
		    
			case CONNECT_COMMAND:

				if( data.length > 0 ){
				
					var keyval = data.split( ",");
			
					if( keyval[0] != this._userid ){
					
						this.openFriendStream( keyval[0], keyval[1] );
					}
				}
			
			break;
		}
	}
}

SocialConnect.prototype.lookupComplete = function(){

	this._chunks = new Array();
	this._chunks_fetched = 0;
	this._chunks_index = 0;

	this._fetching = false;

	this.openFriendStreams( this._connected_friends );
	
	this.onlookup && this.onlookup( this._connected_friends.length );
    
}

/*
* Send to all connected friends
*/

SocialConnect.prototype.send = function( msg ){
    if( this._me_stream.readyState == HydnaStream.OPEN ){
        this._me_stream.send( msg );
    }
}

SocialConnect.prototype.lookup = function(){
		
    if( this._friends.length > 0 && this._fetching == false ){
			
		this._fetching = true;
			
		this._chunks = [];
			
		if( this._friends.length > MAX_CHUNK_SIZE ){
				
			var chunk_count = Math.round( (this._friends.length / MAX_CHUNK_SIZE) );
			
			if( this._friends.length % MAX_CHUNK_SIZE > 0 ){
			    chunk_count = Math.round( (this._friends.length / MAX_CHUNK_SIZE) + .5 );
			}
				
			for( var i = 0; i < chunk_count; i++ ){

				var startindex = i * MAX_CHUNK_SIZE;
				var endindex = Math.min( startindex + MAX_CHUNK_SIZE, this._friends.length );
					
				this._chunks.push( this._friends.slice( startindex, endindex ) );
			}
				
		}else{ // we are good to go in one chunk!
			
			this._chunks.push( this._friends.slice() );
		}
			
		this._chunks_fetched = 0;
		this._chunks_index = 0;
			
		this.performLookup( this._chunks[this._chunks_index] );
		
	}	
}

SocialConnect.prototype.performLookup = function( chunk ){
	
	if( chunk.length > 0 ){
		
		var lookup_str = LOOKUP_COMMAND;
		var ids = new Array();

		for( var i = 0, l = chunk.length; i < l; i++ ){
		 	ids.push( chunk[i].id );
		}
		
		lookup_str += ids.join(",");
        
        if( this._me_stream.readyState == HydnaStream.OPEN ){
            
		    this._me_stream.emit( lookup_str );
		
		    this._chunks_index++;
		
		    if( this._chunks_index < this._chunks.length ){
			    this.performLookup(this._chunks[this._chunks_index]);
		    }
		    
		    return true;
		}
	}
	
	return false;
}

SocialConnect.prototype.openFriendStreams = function( friends ){
	
	for( var i = 0, l = friends.length; i < l; i++  ){
		if( friends.hasOwnProperty(i) ){
			this.openFriendStream( friends[i].id, friends[i].stream );
		}
	}
	
}

SocialConnect.prototype.removeStream = function( id ){
    
    if( this._connected_friends_streams[id] != null && this._connected_friends_streams[id] != undefined ){
			
		var conn = this._connected_friends_streams[id].stream;
		
		delete this._connected_friends_streams[id];
		
		conn.close();
		
		return true;
	}
	
	return false;
}

SocialConnect.prototype.openFriendStream = function( id, stream ){
	
	if( !this.isFriendListed(id) ){
	    
	    var self = this;
	    
		var fstream = new HydnaStream( this._domain_addr + "/" + stream, 'r', this._userid +","+ this._me_stream.uri.ch );
		fstream.onerror = function( evt ){
		    // need to add error callbacks
		}
		
		fstream.onmessage = function( msg ){
			self.handleFriendMessage( msg, self.getPropsForFriend( {id: id} ) );	    
		}
		
		fstream.onsignal = function( msg, flag ){
		    self.handleFriendSignal( msg );
	    }
		
		fstream.onopen = function(){
			
			for( var i in self._connected_friends_streams ){
				
				if( self._connected_friends_streams.hasOwnProperty(i) ){
				
					if( self._connected_friends_streams[i].stream == fstream ){
						
						self._connected_friends_streams[i].connected = true;
					
						var id = self._connected_friends_streams[i].id;
					
						self.onfriendopen && self.onfriendopen( self.getPropsForFriend( {id: id} ) ); 
						
						break;
					}
				}
			}
		}
		
		fstream.onclose = function(){
		    
		    self.removeFriend( id );
		}

		this._connected_friends_streams[id] = { id: id, stream: fstream, connected: false };
	}
}

SocialConnect.prototype.getServiceTagNeutral = function( id ){
	
	if( id.substr(0, this._servicetag.length) == this._servicetag ){
		id = id.substr( this._servicetag.length, id.length );
	}
	
	return id;

}

SocialConnect.prototype.handleFriendSignal = function( msg ){
	
	if( msg.length >= COMMAND_SIZE ){
	
		var type = msg.substr( 0, COMMAND_SIZE );
	
		var data = '';
	
		if( msg.length > COMMAND_SIZE ){
			data = msg.substr( COMMAND_SIZE, msg.length );
		}
	
		switch( type ){
		
			case DISCONNECT_COMMAND:
		
				if( data.length > 0 ){
			
					var keyval = data.split( ",");
					
					this.removeFriend( keyval[0] );
				}
			
			break;
		}
	}
}

SocialConnect.prototype.removeFriend = function( id ){
    
    if( this.isFriendListed( id ) ){
	
		if( this.removeStream( id ) ){
		
		    this.onfriendclose && this.onfriendclose( this.getPropsForFriend( {id: id} ) ); 
	    }
	
	}
    
}

SocialConnect.prototype.handleFriendMessage = function( msg, user ){

	this.onfriendmessage && this.onfriendmessage( msg, user ); 
}

SocialConnect.prototype.getConnectedFriends = function(){
	
	var friends = [];
	
	for( var i in this._connected_friends_streams ){
		
		if( this._connected_friends_streams.hasOwnProperty(i) ){
		
			if( this._connected_friends_streams[i].connected ){
			
				var id = this._connected_friends_streams[i].id;
			
				var friendobj = { id: id };
			
				friendobj = this.getPropsForFriend( friendobj );
			
				friends.push( friendobj );
			}
		}
	}
	
	return friends;
}

SocialConnect.prototype.getPropsForFriend = function( friend ){
		
	var fixedfriend = { id: friend.id };
		
	for( var i = 0, l = this._friends.length; i < l; i++){
		
		if( this._friends.hasOwnProperty(i) ){
			
			if( this._friends[i].id == friend.id ){
				
				for( var j in this._friends[i] ){
					
					if(  this._friends[i].hasOwnProperty(j) ){
					
						if( j != "id" ){
						
							fixedfriend[j] = this._friends[i][j];
						}
					}
				}
				
				fixedfriend.id = this.getServiceTagNeutral( fixedfriend.id );
				
				return fixedfriend;
			}
		}
	}
		
	return null;
}

SocialConnect.prototype.isFriendListed = function( id ){
		
	var realid = id;
		
	if( id.substr(0, this._servicetag.length) != this._servicetag ){
		realid = this._servicetag + realid;
	}
		
	if( this._connected_friends_streams[realid] != null && this._connected_friends_streams[realid] != undefined ){
		return true;
	}
		
	return false;	
}

SocialConnect.prototype.destroy = function(){
	
	if( this._connected ){
		
		if( this._me_stream != null ){
			
			this._me_stream.close();
		}
		
		for( var i in this._connected_friends_streams ){
			
			if( this._connected_friends_streams.hasOwnProperty(i) )
				
				var stream = this._connected_friends_streams[i].stream;
				stream.close();
			
				delete this._connected_friends_streams[i];
			}
		}
		
		this._connected = false;
		this._connecting = false;
		this._fetching = false;
		this._connected_friends = [];
		this._connected_friends_streams = {};
		this._friends = [];
		this._chunks = [];
		this._chunks_index = 0;
		this._chunks_fetched = 0;
		
	}
	
}

return SocialConnect;
})();