import { describe, expect, it } from 'vitest';
import { cvss3BaseScore } from '../cvss';

describe('cvss3BaseScore', () => {
  it('retrouve les scores publiés', () => {
    // Log4Shell (CVE-2021-44228) : 10.0
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')).toBe(10);
    // Heartbleed (CVE-2014-0160, NVD v3) : 7.5
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N')).toBe(7.5);
    // glibc iconv (CVE-2024-2961, cote glibc) : 7.3
    expect(cvss3BaseScore('CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:H')).toBe(7.3);
    // Sans impact : 0
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toBe(0);
  });

  it('refuse un vecteur incomplet ou d’une autre version', () => {
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L')).toBeNull();
    expect(cvss3BaseScore('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N')).toBeNull();
  });
});
