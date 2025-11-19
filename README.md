# Endpoints

## IMAGE API
``GET`` <strong>/api/data</strong> 
> Get image data.

#### Params
| Param Name | Required | Description                  |
|------------|----------|------------------------------|
| url        | Yes      | The direct url of the image. |

#### Example Response: 
```json
  {
   "width": 1200,
   "height": 600,
   "type": "image/png",
   "size": 72566,
   "success": true
  }
```

``GET`` <strong>/api/preview</strong>
> Get an image preview from a website.

#### Params
| Param Name | Required | Description                  |
|------------|----------|------------------------------|
| url        | Yes      | The direct url of website. |

#### Response: 
```Image Buffer```

``GET/POST`` <strong>/api/watermark</strong>
> Add an overlay to an image.

#### Params
| Param Name | Required | Description                                                                                                                                                                                               |
|------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| image      | Yes      | The background image url.                                                                                                                                                                                 |
| watermark  | Yes      | The overlay image url.                                                                                                                                                                                    |
| position   | No       | <strong>Options</strong> `{vertical}-{horizontal}`<br>The overlay image position. <br><br><strong>1. Vertical</strong><ul><li>top</li><li>center</li><li>bottom</li></ul> <strong>2. Horizontal</strong><ul><li>left</li><li>center</li><li>right</li></ul><strong>Default:</strong> `center-center`. |
| size       | No       | The size of the overlay.  <br><strong>Default:</strong> `20`.                                                                                                                                                 |

#### Response: 
```Image Buffer```

``POST`` <strong>/api/convert</strong>
> Convert an Image into `DataURI`.

#### Params
| Param Name | Required | Description                  |
|------------|----------|------------------------------|
| url        | Yes      | The direct url of the image. |

#### Example Response: 
```json
  {
   "dataUri": {
      "base64": "",
      "type": "*/*",
      "format": "data:*/*;"
    }
  }
```

## LIVE API

``GET`` <strong>/api/live/tiktok</strong>
> Checks if a user is currently live or not and returns the data.

#### Params
| Param Name | Required | Description                  |
|------------|----------|------------------------------|
| username        | Yes      | The username of the tiktok user. |

#### Example response:
```json
{
  "success": true,
  "data": {
    //over a thousand lines of tiktok live data
    "cover_image": "https://zdyhhyylm6fts9sa.public.blob.vercel-storage.com/MEOW_canticlegaming_livecover.jpg"
  }
}

{
  "success": false,
  "error": "LIVE has ended"
 }
```
