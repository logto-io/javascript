import { LogtoUser } from '@logto/next';
import Link from 'next/link';
import { useMemo } from 'react';
import useSWR from 'swr';

const Home = () => {
  const { data } = useSWR<LogtoUser>('/api/user');
  const { data: protectedResource } = useSWR<{ data: string }>('/api/protected-resource');

  const userInfo = useMemo(() => {
    if (!data?.isAuthenticated || !data.claims) {
      return null;
    }

    return (
      <div>
        <h2>User info:</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.claims).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [data]);

  return (
    <div>
      <header>
        <h1>Hello Logto.</h1>
      </header>
      <nav>
        {data?.isAuthenticated ? (
          <Link href="/api/sign-out">
            <a>Sign Out</a>
          </Link>
        ) : (
          <Link href="/api/sign-in">
            <a>Sign In</a>
          </Link>
        )}
      </nav>
      {userInfo}
      {protectedResource && (
        <div>
          <h2>Protected resource:</h2>
          <div>{protectedResource.data}</div>
          <h3>
            <Link href="/protected">Example: Require sign in and auto redirect</Link>
          </h3>
        </div>
      )}
    </div>
  );
};

export default Home;
