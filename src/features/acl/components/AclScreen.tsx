'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPolicy } from '../api';
import { FleetPolicyList } from './FleetPolicyList';
import { RawPolicyEditor } from './RawPolicyEditor';

export function AclScreen() {
  const { data: policy } = useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });

  return (
    <div className="flex flex-col gap-6">
      <FleetPolicyList />
      {policy && <RawPolicyEditor policy={policy} />}
    </div>
  );
}
