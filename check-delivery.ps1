$response = Invoke-WebRequest -Uri 'https://api-staging.igroup.website/api/delivery-zones' -Headers @{'X-Company-Id'='kids-velvet'; 'X-Site-Id'='kids-velvet-storefront'} -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
Write-Host "Delivery zones count: $($json.Count)"
$json | ForEach-Object { Write-Host "  - $($_.city_name) ($($_.city_key)): $($_.delivery_price) $($_.currency)" }