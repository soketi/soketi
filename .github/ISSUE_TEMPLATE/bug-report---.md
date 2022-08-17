---
name: "Bug Report \U0001F41E"
about: Report a bug
title: "[BUG] "
labels: bug
assignees: ''

---

**Description**
A clear and concise description of what the bug is.

**Reproduction steps**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment**
- Soketi version (i.e. 1.3.0): 
- Adapter (local, redis): local
- App Manager (array, mysql, postgres, dynamodb) : array
- Queue (sqs, redis, sync): sync
- Cache Managers (memory, redis): memory

**Configuration**
Run the server with `SOKETI_DEBUG=1` and paste the nested object configuration that outputs:
```js
{
    //
}
```

**Additional context**
Add any other context about the problem here.
