$response = Invoke-WebRequest -Uri 'https://api-staging.igroup.website/api/storefront/content?locale=ar' -Headers @{'X-Company-Id'='kids-velvet'; 'X-Site-Id'='kids-velvet-storefront'} -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
Write-Host "Products count: $($json.products.Count)"
Write-Host "Categories count: $($json.categories.Count)"
Write-Host "Brands count: $($json.brands.Count)"