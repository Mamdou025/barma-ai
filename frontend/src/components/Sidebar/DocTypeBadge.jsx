import React from 'react';

const TYPE_LABELS = {
  lois_reglements: 'Lois & règlements',
  jurisprudence: 'Jurisprudence',
  doctrine: 'Doctrine',
  rapports_publics: 'Rapports publics',
  unknown: 'Unknown'
};

const DocTypeBadge = ({ type, state }) => {
  const finalType = type || 'unknown';
  const label = TYPE_LABELS[finalType] || TYPE_LABELS.unknown;

  const classes = ['doc-badge'];
  if (state === 'loading') {
    classes.push('doc-badge--loading');
  } else if (state === 'error') {
    classes.push('doc-badge--error');
  } else {
    classes.push(`doc-badge--${finalType}`);
  }

  return <span className={classes.join(' ')}>{label}</span>;
};

export default DocTypeBadge;
