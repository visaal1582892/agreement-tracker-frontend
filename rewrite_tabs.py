import re

file_path = "src/pages/agreements/AgreementDetailPage.jsx"
with open(file_path, "r") as f:
    content = f.read()

# Add the Products tab
content = re.sub(
    r'(<Tabs value={activeTab}.*?>\s*<Tab label="Details" value="details" />)',
    r'\1\n          <Tab label="Products" value="products" />',
    content
)

# Convert {activeTab === 'history' ? ( ... ) : ( ... )} to individual blocks
# Match from `{activeTab === 'history'` to the closing `</Paper>` for history
content = re.sub(
    r"\{activeTab === 'history' && !isOperationalReview \? \((.*?)\s*\) : \(\s*<Box>\s*<Box sx={{ width: '100%' }}>",
    r"{activeTab === 'history' && !isOperationalReview && (\1)}\n\n      {activeTab === 'products' && !isOperationalReview && (\n        <Box sx={{ mt: 2 }}>\n          <ComputedProductsTable agreementVersionId={selectedVersionId} />\n        </Box>\n      )}\n\n      {activeTab === 'details' && (\n        <Box>\n          <Box sx={{ width: '100%' }}>",
    content,
    flags=re.DOTALL
)

# Finally, remove the trailing `)}` for the ternary
# It's right before `<Dialog` for submitModal.
# So look for `</Box>\n      )}\n\n      <Dialog` and replace with `</Box>\n      )}\n\n      <Dialog`
content = re.sub(
    r"</Box>\n\s*</Box>\n\s*\)}\n\n\s*<Dialog",
    r"</Box>\n        </Box>\n      )}\n\n      <Dialog",
    content
)


with open(file_path, "w") as f:
    f.write(content)
