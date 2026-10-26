# Production controls runbook

## Purpose and safety boundary

This runbook records production-control verification that cannot be proven from local source. It is not a deployment procedure and does not assert that any live setting is enabled.

All live settings, response-header checks, catalog/grant checks, and restore exercises are manual authorized actions. Perform them only through the approved operational change process and record the resulting evidence outside this repository.

Do not put real secrets, passwords, MFA codes, portal codes, personal data, IP addresses, connection strings, authorization headers, tokens, or hash values in this runbook or its evidence summary.

## Shared evidence record template

Create one evidence record for each completed control check. Keep sensitive artifacts in the approved restricted evidence store rather than in Git.

- Date/time:
- Approved operator role:
- Project/environment label:
- Result:
- Evidence location:
- Follow-up owner:

## Leaked-password protection

Manual controlled production verification only: requires authorized live access and real evidence.

1. In the production Auth password-security settings, verify that breached/leaked-password protection is enabled.
2. Save the setting and capture a non-secret confirmation of the enabled state in the approved evidence store.
3. Record the outcome with the shared evidence template. Do not test with a real password or save any test password.

## GraphQL exposure

Manual controlled production verification only: requires authorized live access and real evidence.

1. Inventory every approved GraphQL consumer and its accountable owner.
2. If there is no approved consumer, manually disable or restrict GraphQL exposure through the authorized production control plane.
3. If exposure remains enabled, record the required schema and role, an RLS review, and a least-privilege justification before approval.
4. Do not perform unauthenticated enumeration. Treat the live exposure setting and its review as a manual authorized action.

## MFA and session review

Manual controlled production verification only: requires authorized live access and real evidence.

1. Record the enabled MFA factors and the enrollment/enforcement decision for platform and tenant administrators.
2. Complete and record a privileged-account MFA sign-in test without recording credentials, codes, or personal data.
3. Review the current Auth session controls in the authorized production interface: session lifetime, inactivity and absolute-session limits, refresh-token reuse or rotation behavior, and concurrent-session policy.
4. Store actual values only in the approved evidence record. Any exception requires a named approver and review date in that restricted record.

## Backup/PITR restore exercise

Manual controlled production verification only: requires authorized live access and real evidence.

1. Confirm the production backup plan, retention, and PITR window; select an approved restore timestamp through the change process.
2. Perform the restore manually into an isolated non-production target. A restore is an authorized action, not a local repository test.
3. Run schema/migration, tenant-isolation, audit-read, and authenticated smoke checks against the restored target.
4. Record the requested and actual restore point, restoration elapsed time, outcome, observed RPO/RTO, and cleanup confirmation using the evidence record.
5. Never store restored personal data, credentials, or connection strings in Git or in this runbook.

## Host CSP and Permissions-Policy

Manual controlled production verification only: requires authorized live access and real evidence.

1. Configure CSP and Permissions-Policy at the approved CDN or host. This live header change is a manual authorized action; begin CSP in report-only mode.
2. Before enforcing CSP, use the production asset and network inventory to allow only observed required hosts. The enforced policy must define `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `object-src 'none'`, `base-uri`, `form-action`, and `frame-ancestors`; do not allow wildcard script sources or `unsafe-eval`.
3. Set a restrictive Permissions-Policy that disables unused capabilities, including camera, microphone, payment, USB, and geolocation unless an approved feature requires one.
4. Manually verify the actual HTTPS response headers after deployment and record violations, remediation, and enforcement approval as real evidence.

## Portal rate limits

Manual controlled production verification only: requires authorized live access and real evidence.

1. Record the intended control as 60 requests per 60 seconds, scoped by tenant, portal code hash, and client-fingerprint hash. Do not record a portal code or any hash value.
2. Treat live catalog and grant checks as manual authorized actions: confirm the rate-limit table remains RLS-enabled, has no anonymous or authenticated grant or policy, and is reached only through the server-side service-role path.
3. In an approved non-production exercise, verify that the limit response is 429 and that a new time window recovers access.
4. Confirm that resulting logs contain only error and correlation metadata, never portal codes or hash values. Record the result and evidence location with the shared template.
