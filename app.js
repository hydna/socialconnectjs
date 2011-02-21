var app = {
    
    settings : {
        appid : '182308388471897',
        domainaddr : 'livescenen.hydna.net:7010',
        rendevousaddr : 'livescenen.hydna.net:7010/10000',
        permissions: { perms:'read_stream,publish_stream' }
    },
    
    facebookchannel : null,
    facebookapi : null,
    facebookconnected : false,
    
    init : function(){
        
        var self = this;
        this.facebookchannel = new SocialConnect( this.settings.domainaddr, this.settings.rendevousaddr );
        this.facebookapi = FB;
        
        this.facebookapi.init({
 		     appId  : this.settings.appid,
		     status : true,
		     cookie : true,
		     xfbml  : true
		});
		
		this.check_session();
        
    },
    
    check_session : function(){
      
      var self = this;
      
      this.facebookapi.getLoginStatus(function(response) {
			
			if (response.session) {
				// jk: there is a bug in the current getLoginStatus method Facebook JavaScript SDK -- it doesn't return permissions as expected. the best we can do is manually ask.
				self.facebookapi.api({
			            method : 'fql.query',
			            query : 'SELECT status_update,photo_upload,sms,offline_access,email,create_event,rsvp_event,publish_stream,read_stream,share_item,create_note,bookmarked,tab_added FROM permissions WHERE uid=' + self.facebookapi.getSession().uid
			       },
			       function(response) {
					var perms = [];
					for(perm in response[0]) {
						if(response[0][perm] == '1') perms.push(perm);
					}
					
					self.facebookconnected = true;
					
					self.fetchuserdetails();
					
			       });
			
			}else{
			    
			    $("#status").html( "Please login" );
			    $("#btns").show();
			    $("#btns a").click( function(e){
			         
			         e.preventDefault();
			         
			         self.login( self.settings.permissions );
			         
			    });
			}
		});
      
        
    },
    
    login : function( opts ){
        
        var self = this;
        
        if(!opts) opts = {};

		this.facebookapi.login( function(response) {
		    
            if (response.status == 'connected') {
            
                self.facebookapi.getLoginStatus(function(response) {
                    
                if(response.session) {
                        
                        self.facebookconnected = true;
                        
                        self.fetchuserdetails();
               
                    }
                }, true);
                
            }
            
		},opts);
    },
    
    logout : function(){
        
        var self = this;
        
        $("#status").html( "Please login" );
	    $("#btns").show();
	    $("#btns a").html( "Login" );
	    $("#btns a").click( function(e){
	         
	         e.preventDefault();
	         
	         self.login( self.settings.permissions );
	         
	    });
	    
	    this.facebookchannel.destroy();
	    this.facebookconnected = false;
        
        this.facebookapi.logout( function(response) {
            // handle logout complete
        });
    },
    
    fetchuserdetails : function(){
        
        var self = this;
        this.facebookapi.api('/me', function(response) {
          
            $("#status").html( "Welcome " + response.name );
            $("#btns").show();
            $("#btns a").html( "Logout" );
            $("#btns a").click( function(e){
                
                self.logout();
                
            });
          
            self.fetchfriends();
          
        });
        
    },
    
    fetchfriends : function(){
        
        var self = this;
        
        this.facebookapi.api('/me/friends', function(response) {
            
            if( response.data.length > 0 ){
                self.connectfriends( response.data );
            }
        });
    },
    
    connectfriends : function( friends ){
        
        var self = this;
        
        this.facebookchannel.connect( this.facebookapi.getSession().uid, friends, "fb" );
        // a friend connects
        this.facebookchannel.onfriendopen = function( user ){
            console.log( "app -> " + user.name + " connected" );
            
            $('body').append( "<p id='"+user.id+"'>"+user.name+"</p>" );
            
        }
        // when a friend logs out or closes app
        this.facebookchannel.onfriendclose = function( user ){
            console.log( "app -> " + user.name + " disconnected" );
            
             $('#'+user.id).remove();
        }
        // whenever lookup is complete
        this.facebookchannel.onlookup = function( count ){
            console.log( "app -> you have "+ count +" friends connected" );
        }
        // when friend sends a message
        this.facebookchannel.onfriendmessage = function( msg, user ){
            console.log( "app -> received message from "+user.name+" : " + msg );
        }
    }
}