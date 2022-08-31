---
name: "Bug Report \U0001F41E"
about: Report a bug
title: "[BUG] "
labels: bug
assignees: ''

---

<!---
NOTICE: Keep in mind that bugs that state simple usage disfunctionalities (i.e. message did not get sent) are more likely to be your fault for not using the Pusher properly.

After enabling debugging with SOKETI_DEBUG=1, make sure to read the console to see if the message is actually being sent to the server.
-->

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
