export interface IJoinAsDriver {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  yearsOfExperience: number;
  licenseExpiryDate: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  documents?: { url: string }[];
  status: 'pending' | 'approved' | 'rejected';
}


