# Spotify Discord Bot

This bot will pick up currently playing track from Spotify API. Bot needs authorization to use the API, so separate web page in [https://sdb.psykedelia.org/](https://sdb.psykedelia.org/) is required to give permissions before user can use the functionality.

## Usage

### Authorization

- Go to [https://sdb.psykedelia.org/](https://sdb.psykedelia.org/)
- Type in your Discord identifier
- Click `Continue`
- Accept the authorization in Spotify Authorization page
- You are now authorized! Type in `.np` in the Discord channel the bot is in

### Authorization revocation

Spotify OAuth2 doesn't currently provide ways to revoke tokens. That's why you have to click on the `Revoke` link in [https://sdb.psykedelia.org/](https://sdb.psykedelia.org/) and manually remove the `now-playing` application from Spotify Manager.
