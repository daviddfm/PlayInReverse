(function(exports) {
	client_id = 'cfd17821fa704f9d815a03cd2a80abaa';
	redirect_uri = 'https://stormy-ocean-3787.herokuapp.com/';
	
	g_access_token = '';
	g_username = '';

	var doLogin = function(callback) {
		var url = 'https://accounts.spotify.com/authorize?client_id=' + client_id +
			'&response_type=token' +
			'&scope=playlist-read-private%20playlist-modify%20playlist-modify-private' +
			'&redirect_uri=' + encodeURIComponent(redirect_uri);
		window.location = url;
	}

	exports.startApp = function() {
		console.log('start app.');
		$('#start').click(function() {
			doLogin(function() {});
			}
		);
		// try getting an access_token
		var hash = location.hash.replace(/#/g, '');
		var all = hash.split('&');
		var args = {};
		console.log('all', all);
		all.forEach(function(keyvalue) {
			var idx = keyvalue.indexOf('=');
			var key = keyvalue.substring(0, idx);
			var val = keyvalue.substring(idx + 1);
			args[key] = val;
		});

		console.log('got args', args);

		if (typeof(args['access_token']) != 'undefined') {
			// got access token
			console.log('got access token', args['access_token']);
			g_access_token = args['access_token'];
		}

		if (g_access_token) {
			$('#start').hide();
		
			getUsername(function(username) {
				console.log('got username', username);
				g_username = username;
				
				getPlaylists(username, function(playlist) {
					console.log('got playlist', playlist);

					$.each(playlist.items, function(i, row) {
						$('#playlist-list').append('<li><a href="#" data-id="' + row.id + '" data-name="' + row.name + '">' + row.name + ' (' + row.tracks.total + ' tracks)</a></li>');
					});
					
					//$('#playlist-list').listview('refresh');
				});
			});
		}
	}

	$(document).on('click', '#playlist-list li a', function (e) {
		playlistId = $(this).attr('data-id');
		console.log("reversing " + playlistId);

		getTracksForPlaylist(g_username, playlistId, function(tracks) {
			// all the magic happens here:
			tracks.items.sort(function (a, b) {
				if (a.added_at > b.added_at) {
					return 1;
				}
				if (a.added_at < b.added_at) {
					return -1;
				}
				// a must be equal to b
				return 0;
			});
			
			var reversed = {
				uris : []
			}
			
			// construct a reversed track list
			$.each(tracks.items, function(i, row) {
				reversed.uris.push("spotify:track:" + row.track.id);
			});
			
			setTracksForPlaylist(g_username, playlistId, reversed, function(resp) {
				console.log(resp);
				alert("Success!")
				
				$('#playlistlink').show();
				$('#playlistlink').attr('href', 'spotify:user:'+g_username+':playlist:'+playlistId);
			});
		});
	});



function getUsername(callback) {
	console.log('getUsername');
	var url = 'https://api.spotify.com/v1/me';
	$.ajax(url, {
		dataType: 'json',
		headers: {
			'Authorization': 'Bearer ' + g_access_token
		},
		success: function(r) {
			callback(r.id);
		},
		error: function(r) {
			callback(null);
		}
	});
}

function getPlaylists(username, callback) {
	console.log('getPlaylists', username);
	var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/';
		
	$.ajax(url, {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + g_access_token,
			'Accept': 'application/json'
		},
		success: function(r) {
			callback(r);
		},
		error: function(r) {
			callback(null);
		}
	});
}

function getTracksForPlaylist(username, playlist, callback) {
	console.log('getTracksForPlaylist', username, playlist);
	var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlist + '/tracks';
		
	$.ajax(url, {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + g_access_token,
			'Accept': 'application/json'
		},
		success: function(r) {
			callback(r);
		},
		error: function(r) {
			callback(null);
		}
	});
}

function createOrFindPlaylist(username, playlist, callback) {
	var li = $('#playlist-list > li > a[data-id="' + playlist + '"');
	playlist = li.attr('data-name') + ' Now';

	console.log('createOrFindPlaylist', playlist);

	li = $('#playlist-list > li > a[data-name="' + playlist + '"');
	if ( li.length == 1 ) {
		callback(li.attr('data-id'));
	}

	var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/';
	$.ajax(url, {
		method: 'POST',
		data: JSON.stringify({ name: playlist, public: true}),
		headers: {
			'Authorization': 'Bearer ' + g_access_token,
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		success: function(r) {
			callback(r.id);
		},
		error: function(r) {
			callback(null);
		}
	});
}

function setTracksForPlaylist(username, playlist, tracks, callback) {
	console.log('setTracksForPlaylist', tracks, playlist);

	playlist = createOrFindPlaylist(username, playlist, function(playlist) {

		var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlist + '/tracks';

		$.ajax(url, {
			method: 'PUT',
			data: JSON.stringify(tracks),
			headers: {
				'Authorization': 'Bearer ' + g_access_token,
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			success: function(r) {
				callback(r);
			},
			error: function(r) {
				callback(null);
			}
		});
	});
}

})(window);
