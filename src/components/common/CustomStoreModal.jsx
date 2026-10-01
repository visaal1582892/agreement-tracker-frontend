import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid,
} from '@mui/material';

export default function CustomStoreModal({ open, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    storeId: '',
    name: '',
    address: '',
    pinCode: '',
    region1: '', // Country
    region2: '', // State
    region3: '', // City
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      isCustom: true,
    });
    setFormData({
      storeId: '', name: '', address: '', pinCode: '', region1: '', region2: '', region3: '',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Custom Store</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Store ID *"
              name="storeId"
              value={formData.storeId}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Store Name *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Country"
              name="region1"
              value={formData.region1}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="State"
              name="region2"
              value={formData.region2}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="City"
              name="region3"
              value={formData.region3}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Pin Code"
              name="pinCode"
              value={formData.pinCode}
              onChange={handleChange}
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!formData.storeId || !formData.name}
        >
          Add Store
        </Button>
      </DialogActions>
    </Dialog>
  );
}
