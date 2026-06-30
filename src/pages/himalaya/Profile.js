import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PageShell from '../../components/PageShell/PageShell';
import { ADMIN_AVATAR } from '../../utils/customerPhotos';
import { getCurrentAdminProfile } from '../../utils/adminAuth';
import { useSettings } from '../../context/SettingsContext';
import './UtilityPages.css';

export default function Profile() {
  const [admin, setAdmin] = useState({});
  useEffect(() => {
    getCurrentAdminProfile().then(setAdmin).catch(() => setAdmin({}));
  }, []);
  const { settings } = useSettings();
  const fields = [
    ['Name', admin.name || 'Himaliya Admin'],
    ['Phone', settings.businessPhone || 'Not set'],
    ['Email', admin.email || 'Not set'],
    ['Role', admin.role || 'Admin'],
  ];

  return (
    <PageShell title="Profile" subtitle="Current user and business details">
      <motion.section className="profile-grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <aside className="profile-card profile-card--identity">
          <img src={ADMIN_AVATAR} alt={`${admin.name || 'Admin'} profile`} />
          <h2>{admin.name || 'Himaliya Admin'}</h2>
          <span>{admin.role || 'Admin'} access</span>
          <p>Signed in to Himaliya Spring Water operations.</p>
        </aside>
        <div className="profile-card">
          <div className="water-page-card__header"><div><span>Personal information</span><h2>Account details</h2></div></div>
          <dl className="profile-details">
            {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <div className="profile-business"><span>Business</span><h3>{settings.businessName}</h3><p>{settings.businessAddress}</p></div>
        </div>
      </motion.section>
    </PageShell>
  );
}
