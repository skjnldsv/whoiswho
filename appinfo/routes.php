<?php

return [
	'routes' => [
		['name' => 'page#index',              'url' => '/',                   'verb' => 'GET'],
		['name' => 'team#index',              'url' => '/team',               'verb' => 'GET'],
		['name' => 'leaderboard#getScores',   'url' => '/leaderboard',        'verb' => 'GET'],
		['name' => 'leaderboard#submitScore', 'url' => '/leaderboard/score',  'verb' => 'POST'],
	]
];
