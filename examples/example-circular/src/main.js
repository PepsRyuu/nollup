import moment from 'moment';
import A1 from './A1.js';
import SweetAlert from 'sweetalert2';

console.log(SweetAlert)

A1();

document.body.innerHTML = `
    <p>
        Console should say the following:
        <pre><code>
            B
            A2
            wrapper-a1 A3
        </pre></code>
    </p>
    <p>
        Date from MomentJS: ${moment(new Date()).format('YYYY-MM-DD hh:mm')}
    </p>
`;
