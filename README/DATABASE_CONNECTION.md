# Database Connection Guide

## Direct Connection to Supabase PostgreSQL

### Connection Format

Use the direct connection string format:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### Finding Your Connection Details

1. **Go to your Supabase Project Dashboard**
2. **Navigate to**: Project Settings > Database
3. **Find**: Connection String section
4. **Copy**: The "Connection string" under "Direct connection"

### Example Connection String

```
postgresql://postgres:your-password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres
```

### Using psql Command Line

```bash
PGPASSWORD='your-password' psql -h db.abcdefghijklmnopqrst.supabase.co -U postgres -d postgres -c "YOUR SQL QUERY"
```

**Replace:**
- `your-password` with your actual database password
- `abcdefghijklmnopqrst` with your project reference ID

### Connection Pooling vs Direct Connection

**Session Mode (Direct Connection)** - Port 5432
- Use for: Admin operations, migrations, one-off queries
- Format: `postgresql://postgres:password@db.PROJECT_REF.supabase.co:5432/postgres`

**Transaction Mode (Pooled)** - Port 6543
- Use for: Application connections, high concurrency
- Format: `postgresql://postgres:password@db.PROJECT_REF.supabase.co:6543/postgres`

### Common Issues

#### "Tenant or user not found"
- You're using the wrong project reference or pooler endpoint
- Use the direct connection endpoint: `db.PROJECT_REF.supabase.co`
- Check your project reference in Supabase dashboard

#### Connection timeout
- Check if your IP is allowed in Supabase database settings
- Verify the project reference is correct
- Ensure you're using port 5432 for direct connections

### Security Notes

- **Never commit passwords to git**
- Store connection strings in `.env.local`
- Use environment variables for production deployments
- Rotate passwords periodically

### Documentation Reference

For more details, see official Supabase documentation:
https://supabase.com/docs/guides/database/connecting-to-postgres
