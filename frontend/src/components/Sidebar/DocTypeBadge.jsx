import React from 'react';

export const LABELS = {
  lois_reglements: 'Lois & règlements',
  jurisprudence: 'Jurisprudence',
  doctrine: 'Doctrine',
  rapports_publics: 'Rapports publics',
  unknown: 'Type inconnu'
};

const DocTypeBadge = ({ type, status }) => {
  let label = LABELS[type] || LABELS.unknown;
  let className = 'doc-badge';

  if (status === 'loading') {
    className += ' doc-badge--loading';
    label = '...';
  } else if (status === 'error') {
    className += ' doc-badge--error';
    label = 'Erreur';
  } else {
    const typeClass = `doc-badge--${type || 'unknown'}`;
    className += ` ${typeClass}`;
  }

  return <span className={className}>{label}</span>;
};

export default DocTypeBadge;
