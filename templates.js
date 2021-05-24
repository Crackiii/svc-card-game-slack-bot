const question_template = {
	"blocks": [
		{
			"type": "image",
			"title": {
				"type": "plain_text",
				"text": "I Need a Marg",
				"emoji": true
			},
			"image_url": "https://assets3.thrillist.com/v1/image/1682388/size/tl-horizontal_main.jpg",
			"alt_text": "marg"
		},
		{
			"type": "divider"
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"style": "primary",
					"text": {
						"type": "plain_text",
						"text": "Rotate Image",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "rotate_image"
				}
			]
		},
		{
			"type": "divider"
		},
		{
			"block_id": 'typed_question',
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "typed_question"
			},
			"label": {
				"type": "plain_text",
				"text": "Type in the question",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"style": "primary",
					"text": {
						"type": "plain_text",
						"text": "Submit Question",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "submit_question"
				},
				{
					"type": "button",
					"style": "danger",
					"text": {
						"type": "plain_text",
						"text": "End Game",
						"emoji": true
					},
					"confirm": {
						"title": {
							"type": "plain_text",
							"text": "Confirm Please!"
						},
						"text": {
							"type": "mrkdwn",
							"text": "Are you sure and want to end the game?"
						},
						"confirm": {
							"type": "plain_text",
							"text": "Yes, please"
						},
						"deny": {
							"type": "plain_text",
							"text": "Cancel"
						}
					},
					"value": "click_me_123",
					"action_id": "end_game"
				}
			]
		},
		{
			"type": "divider"
		}
	]
}


const play_next_card_template = {
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "plain_text",
				"text": "Would you like to play another card?",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Load another Card",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "load_card"
				},
				{
					"type": "button",
					"style": "danger",
					"text": {
						"type": "plain_text",
						"text": "End Game!",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "end_game"
				}
			]
		}
	]
}

const answer_request_template = {
	"blocks": [
		{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"action_id": "plain_text_input-action"
			},
			"label": {
				"type": "plain_text",
				"text": "Type in your answer",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Submit Answer",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "submit_answer"
				},
				{
					"type": "button",
					"style": "danger",
					"text": {
						"type": "plain_text",
						"text": "End Game!",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "end_game"
				}
			]
		},
		{
			"type": "divider"
		}
	]
}

const game_over_template = {
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "plain_text",
				"text": "Game has been ended, thank you both for your time :smile:",
				"emoji": true
			}
		}
	]
}

module.exports = {question_template, play_next_card_template, answer_request_template, game_over_template}