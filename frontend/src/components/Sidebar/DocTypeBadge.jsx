import React from 'react';

const TYPE_CONFIG = {
  lois_reglements: {
    label: 'Lois & règlements',
    className: 'doc-badge--lois_reglements'
  },
  jurisprudence: {
    label: 'Jurisprudence',
    className: 'doc-badge--jurisprudence'
  },
  doctrine: {
    label: 'Doctrine',
    className: 'doc-badge--doctrine'
  },
  rapports_publics: {
    label: 'Rapports publics',
    className: 'doc-badge--rapports_publics'
  },
  unknown: {
    label: 'Inconnu',
    className: 'doc-badge--unknown'
  }
};

const DocTypeBadge = ({ type = 'unknown' }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.unknown;
  return (
    <span className={`doc-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default DocTypeBadge;
