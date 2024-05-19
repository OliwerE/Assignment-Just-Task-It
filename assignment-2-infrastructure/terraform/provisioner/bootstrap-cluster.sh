#!/bin/bash

JOIN="'sudo rm -fv /etc/containerd/config.toml \
    && sudo systemctl restart containerd \
    && sudo $(kubeadm token create --print-join-command)'"

for IP in "$@"
do
    echo -e "\n--------------------------\n${IP} join cluster\n--------------------------\n"
    {
        ssh -o StrictHostKeyChecking=no -i $HOME/.ssh/2dv013-key ubuntu@"$IP" 'bash -s' < $HOME/bin/node-init.sh
        ssh -o StrictHostKeyChecking=no -i $HOME/.ssh/2dv013-key ubuntu@"$IP" 'bash -c' $JOIN
    } &
done
wait