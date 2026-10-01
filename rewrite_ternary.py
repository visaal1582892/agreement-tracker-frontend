import re

file_path = "src/pages/agreements/AgreementDetailPage.jsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace the closing of the details block
target = """            )}
          </Box>
        </Box>
      )}

      <Dialog"""
replacement = """            )}
          </Box>
        </Box>
      )}

      <Dialog"""

# Wait, if I replace the ternary, let me check what it is now.
