(function(exports) {
	client_id = 'cfd17821fa704f9d815a03cd2a80abaa';
	redirect_uri = 'https://spotify.dawson.fm/';
	
	g_access_token = '';
	g_username = '';

	var doLogin = function(callback) {
		var url = 'https://accounts.spotify.com/authorize?client_id=' + client_id +
			'&response_type=token' +
			'&scope=' + encodeURIComponent('playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private') +
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

				refreshPlaylists();
			});
		}
	}

	$(document).on('click', '#playlist-list li a.sort', function (e) {
		var playlistA = $(this);

		playlistId = $(this).parent().attr('data-id');
		playlistName = $(this).parent().attr('data-name');
        username = $(this).parent().attr('data-owner');

		console.log("Sorting " + playlistName);
		$(this).text(" Sorting... ");


		getTracksForPlaylist(username, playlistId, function(tracks) {

			var oldTracks = JSON.parse(JSON.stringify(tracks.items));
			var newTracks = tracks.items;

			// all the magic happens here:
			newTracks.sort(function (a, b) {
				if (a.added_at > b.added_at) {
					return -1;
				}
				if (a.added_at < b.added_at) {
					return 1;
				}
				// a must be equal to b
				return 0;
			});

            $('#playlist-list').addClass('hide');

            sortTable = $('#sort-debug');
            sortTable.html('');
            sortTable.removeClass('hide');

            $.each(newTracks, function(i, row) {
                sortTable.append( '<div class="row"><div class="old col-xs-6">' + oldTracks[i].track.name + '</div><div class="new col-xs-6">' + newTracks[i].track.name + '</div></div>' );
            });

            sortTracks(username, playlistId, oldTracks, newTracks, function(resp) {
				console.log(resp);
				window.setTimeout(function() {
					refreshPlaylists();
				}, 3000 );
			});
		});
	});

    $(document).on('click', '#playlist-list li a.copy', function (e) {
        var playlistA = $(this);

        playlistId = $(this).parent().attr('data-id');
        playlistName = $(this).parent().attr('data-name');
        username = $(this).parent().attr('data-owner');

        console.log("Copying " + playlistName);
        playlistA.text( "Copying..." );

        getTracksForPlaylist(username, playlistId, function(tracks) {

            copyPlaylist(g_username, playlistA.parent(), tracks, function(resp) {
                console.log(resp);
                playlistA.text( "Done" );
                window.setTimeout(function() {
                    refreshPlaylists();
                }, 3000 );
            });
        });
    });

function refreshPlaylists() {

    getPlaylists(g_username, function(playlist) {
        console.log('got playlist', playlist);

        playlist.items.sort(function(a,b) {
            if (a.name > b.name) {
                return 1;
            }
            if (a.name < b.name) {
                return -1;
            }
            // a must be equal to b
            return 0;
        });

		$('#sort-debug').addClass('hide');
        $('#playlist-list').html('');
		$('#playlist-list').removeClass('hide');

        $.each(playlist.items, function(i, row) {
            $('#playlist-list').append('<li><div class="" data-owner="' + row.owner.id + '" data-id="' + row.id + '" data-name="' + row.name + '"><img src="' + row.images[0].url + '"/><div>' + row.name + ' (' + row.tracks.total + ' tracks)</div><a href="#" class="sort btn btn-primary btn-sm">Sort</a><a href="#" class="copy btn btn-primary btn-sm">Copy</a></div></li>');
        });

        //$('#playlist-list').listview('refresh');
    });
}

function sortTracks(username, playlistId, oldTracks, newTracks, callback) {
	console.log("sortTracks " + playlistId);

	sortTable = $('#sort-debug');
    $.each(newTracks, function(i, row) {
		$('#sort-debug .row').eq(i).html( '<div class="old col-xs-6">' + oldTracks[i].track.name + '</div><div class="new col-xs-6">' + newTracks[i].track.name + '</div>' );
    });

	movedTrack = false;

	$.each(newTracks, function (i, row) {
		if (row.track.id != oldTracks[i].track.id) {
			console.log("track " + i + "in wrong position");

			// Find old position of track based on added_at which is unique
			var iOld = oldTracks.findIndex(function ( element, index, array ) {
					return ( element.track.id == row.track.id && element.added_at == row.added_at );
				});

			moveTrackFromTo(
				username,
                playlistId,
				iOld,
				i,
				function (resp) {
					if ( resp == null) return;

					var minusOne = oldTracks.slice(0,iOld).concat(oldTracks.slice(iOld+1));

                    if (i > iOld)
                        i = i - 1;

					var oldSorted = minusOne.slice(0,i).concat([oldTracks[iOld]]).concat(minusOne.slice(i));

					sortTracks(username, playlistId, oldSorted, newTracks, callback);
				}
			);

			movedTrack = true;
			return false;
		}
	});

	if ( ! movedTrack )
		callback(true);
}

function moveTrackFromTo(username, playlist, oldI, newI, callback ) {
    var json = JSON.stringify({ "range_start": oldI, "insert_before": newI });

	console.log('moveTrackFromTo ', json );

	var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlist + '/tracks';

	$.ajax(url, {
		method: 'PUT',
		data: json,
		headers: {
			'Authorization': 'Bearer ' + g_access_token,
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		success: function(r) {
			callback(r);
		},
		error: function(r) {
            console.log(r.responseText);
			callback(null);
		}
	});
}



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
            console.log(r.responseText);
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
            console.log(r.responseText);
			callback(null);
		}
	});
}


function getTracksForPlaylist(username, playlist, callback) {

	var consolidatedr = null;
	var getNextTracks = function(r) {
		if ( consolidatedr == null ) {
			consolidatedr = r;
		} else {
			consolidatedr.items = consolidatedr.items.concat(r.items);
		}

		if (r.next != null) {
			$.ajax(r.next, {
				method: 'GET',
				headers: {
					'Authorization': 'Bearer ' + g_access_token,
					'Accept': 'application/json'
				},
				success: getNextTracks,
				error: function (r) {
					console.log(r.responseText);
					callback(null);
				}
			})
		} else {
			callback(consolidatedr);
		}
	};

	console.log('getTracksForPlaylist', username, playlist);
	var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlist + '/tracks';
		
	$.ajax(url, {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + g_access_token,
			'Accept': 'application/json'
		},
		success: getNextTracks,
		error: function(r) {
            console.log(r.responseText);
			callback(null);
		}
	});
}

function copyPlaylist(username, element, tracks, callback) {
	playlist = element.attr('data-name') + ' Copy';

	console.log('copyPlaylist', playlist);

    var trackList = {
        uris : []
    }

    // construct a reversed track list
    $.each(tracks.items, function(i, row) {
	if (row.track.id != null) {
        	trackList.uris = trackList.uris.concat(["spotify:track:" + row.track.id]);
	}
    });

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
            setTracksForPlaylist(username, r.id, trackList, callback);
		},
		error: function(r) {
            console.log(r.responseText);
			callback(null);
		}
	});

}

function setTracksForPlaylist(username, playlist, tracks, callback) {
	console.log('setTracksForPlaylist', tracks, playlist);

    var url = 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlist + '/tracks';
	var last = 0;

	var postNext = function (r) {
		if ( last < tracks.uris.length ) {

			var page = {
				uris : []
			};

			page.uris = tracks.uris.slice(last, last + 100);
			last += 100;

			$.ajax(url, {
				method: 'POST',
				data: JSON.stringify(page),
				headers: {
					'Authorization': 'Bearer ' + g_access_token,
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				success: postNext,
				error: function(r) {
					console.log(r.responseText);
					callback(null);
				}
			});
		}

		callback(r);
	};

	postNext(null);
}

})(window);
